import * as crypto from 'crypto';
import {
  Injectable,
  Optional,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SsoProviderType = 'GOOGLE' | 'APPLE' | 'OIDC';

export interface SsoServiceOptions {
  googleClientId?: string;
  appleClientId?: string;
  oidcClientId?: string;
  oidcIssuer?: string;
  oidcJwksUrl?: string;
  jwksFetcher?: (jwksUrl: string) => Promise<any[]>;
}

export interface VerifiedSsoClaims {
  provider: SsoProviderType;
  subject: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
}

function resolveSsoProviderConfig(
  provider: SsoProviderType,
  options?: SsoServiceOptions,
): {
  configured: boolean;
  clientIds: string[];
  issuers: string[];
  jwksUrl: string;
  label: string;
} {
  switch (provider) {
    case 'GOOGLE': {
      const raw =
        options?.googleClientId || process.env.SSO_GOOGLE_CLIENT_ID || '';
      const clientIds = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        configured: clientIds.length > 0,
        clientIds,
        issuers: ['https://accounts.google.com', 'accounts.google.com'],
        jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
        label: 'Google Account',
      };
    }
    case 'APPLE': {
      const raw =
        options?.appleClientId || process.env.SSO_APPLE_CLIENT_ID || '';
      const clientIds = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        configured: clientIds.length > 0,
        clientIds,
        issuers: ['https://appleid.apple.com'],
        jwksUrl: 'https://appleid.apple.com/auth/keys',
        label: 'Apple ID',
      };
    }
    case 'OIDC': {
      const clientId =
        options?.oidcClientId || process.env.SSO_OIDC_CLIENT_ID || '';
      const issuer = options?.oidcIssuer || process.env.SSO_OIDC_ISSUER || '';
      const jwksUrl =
        options?.oidcJwksUrl || process.env.SSO_OIDC_JWKS_URL || '';
      const clientIds = clientId
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        configured: Boolean(clientIds.length > 0 && issuer && jwksUrl),
        clientIds,
        issuers: issuer ? [issuer] : [],
        jwksUrl,
        label: 'Corporate OIDC',
      };
    }
    default:
      throw new BadRequestException(`Unsupported SSO provider: ${provider}`);
  }
}

export function listConfiguredSsoProviders(options?: SsoServiceOptions) {
  const providers: SsoProviderType[] = ['GOOGLE', 'APPLE', 'OIDC'];
  return providers.map((provider) => {
    const cfg = resolveSsoProviderConfig(provider, options);
    return {
      provider,
      label: cfg.label,
      configured: cfg.configured,
    };
  });
}

@Injectable()
export class SsoService {
  private readonly jwksCache = new Map<string, { keys: any[]; fetchedAt: number }>();
  private readonly JWKS_TTL_MS = 15 * 60 * 1000;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly options?: SsoServiceOptions,
  ) {}

  private getProviderConfig(provider: SsoProviderType) {
    return resolveSsoProviderConfig(provider, this.options);
  }

  listProviders() {
    return listConfiguredSsoProviders(this.options);
  }

  private async fetchJwks(jwksUrl: string, forceRefresh = false): Promise<any[]> {
    const cached = this.jwksCache.get(jwksUrl);
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < this.JWKS_TTL_MS) {
      return cached.keys;
    }

    let keys: any[] = [];
    if (this.options?.jwksFetcher) {
      keys = await this.options.jwksFetcher(jwksUrl);
    } else {
      const res = await fetch(jwksUrl, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new UnauthorizedException(`SSO provider key lookup failed (${res.status}).`);
      }
      const json: any = await res.json();
      keys = Array.isArray(json?.keys) ? json.keys : [];
    }

    this.jwksCache.set(jwksUrl, { keys, fetchedAt: Date.now() });
    return keys;
  }

  async verifyIdToken(provider: SsoProviderType, idToken: string): Promise<VerifiedSsoClaims> {
    const cfg = this.getProviderConfig(provider);
    if (!cfg.configured) {
      throw new BadRequestException(
        `${provider} SSO is not configured on this server yet.`,
      );
    }

    const parts = (idToken || '').split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new UnauthorizedException('Malformed SSO ID token.');
    }

    const [headerB64, payloadB64, sigB64] = parts;
    let header: any;
    let claims: any;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid SSO ID token encoding.');
    }

    if (!header?.alg || (header.alg !== 'RS256' && header.alg !== 'ES256')) {
      throw new UnauthorizedException('Unsupported SSO token signing algorithm.');
    }

    let keys = await this.fetchJwks(cfg.jwksUrl, false);
    let matchedJwk = keys.find((k) => !header.kid || k.kid === header.kid);
    if (!matchedJwk) {
      keys = await this.fetchJwks(cfg.jwksUrl, true);
      matchedJwk = keys.find((k) => !header.kid || k.kid === header.kid);
    }
    if (!matchedJwk) {
      throw new UnauthorizedException('SSO signing key not found in JWKS.');
    }

    let verified = false;
    try {
      const publicKey = crypto.createPublicKey({ key: matchedJwk, format: 'jwk' });
      const alg = header.alg === 'ES256' ? 'SHA256' : 'RSA-SHA256';
      verified = crypto.verify(
        alg,
        Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
        publicKey,
        Buffer.from(sigB64, 'base64url'),
      );
    } catch {
      verified = false;
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid SSO ID token signature.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= now) {
      throw new UnauthorizedException('SSO ID token has expired.');
    }
    if (!claims.iss || !cfg.issuers.includes(String(claims.iss))) {
      throw new UnauthorizedException('Invalid SSO token issuer.');
    }
    const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audList.some((a: any) => cfg.clientIds.includes(String(a)))) {
      throw new UnauthorizedException('SSO token audience mismatch.');
    }

    const emailVerified =
      claims.email_verified === true || claims.email_verified === 'true';
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const subject = typeof claims.sub === 'string' ? claims.sub.trim() : '';

    if (!subject || !email || !emailVerified) {
      throw new UnauthorizedException(
        'SSO account must provide a verified email address and subject.',
      );
    }

    return {
      provider,
      subject,
      email,
      emailVerified,
      fullName: typeof claims.name === 'string' ? claims.name.trim() : undefined,
    };
  }
}
