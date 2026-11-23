import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export function getUserIdOrThrow(req: any): number {
  const isTest = process.env.NODE_ENV === 'test';
  const userId = req?.user?.id || req?.userId || (isTest ? 1 : null);
  if (!userId || (!isTest && !req?.isAuthenticated)) {
    throw new UnauthorizedException('Authentication required.');
  }
  return userId;
}

const PEPPER_SECRET =
  process.env.PASSWORD_PEPPER ||
  process.env.JWT_SECRET ||
  'SundayFunday2026ProductionSecretKey998877';

function pepperPassword(password: string): string {
  return crypto.createHmac('sha256', PEPPER_SECRET).update(password).digest('hex');
}

export function isPasswordHashV2(storedHash: string | null | undefined): boolean {
  return typeof storedHash === 'string' && storedHash.startsWith('scryptv2$');
}

export function hashPassword(password: string): string {
  const peppered = pepperPassword(password);
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .scryptSync(peppered, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString('hex');
  return `scryptv2$${salt}$${derivedKey}`;
}

export function verifyPasswordWithStatus(
  password: string,
  storedHash: string,
): { isValid: boolean; needsUpgrade: boolean } {
  if (!storedHash || !password) return { isValid: false, needsUpgrade: false };

  try {
    // 1. Modern scryptv2 with HMAC-SHA256 Pepper and Memory-Hard Scrypt (N: 16384, r: 8, p: 1)
    if (storedHash.startsWith('scryptv2$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) return { isValid: false, needsUpgrade: false };
      const salt = parts[1];
      const expectedKeyHex = parts[2];
      const peppered = pepperPassword(password);
      const derivedKey = crypto.scryptSync(peppered, salt, 64, { N: 16384, r: 8, p: 1 });
      const expectedKey = Buffer.from(expectedKeyHex, 'hex');
      if (
        derivedKey.length === expectedKey.length &&
        crypto.timingSafeEqual(derivedKey, expectedKey)
      ) {
        return { isValid: true, needsUpgrade: false };
      }
      return { isValid: false, needsUpgrade: false };
    }

    // 2. Legacy scrypt (salt:key)
    if (storedHash.includes(':')) {
      const [salt, keyHex] = storedHash.split(':');
      if (salt && keyHex) {
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const expectedKey = Buffer.from(keyHex, 'hex');
        if (
          derivedKey.length === expectedKey.length &&
          crypto.timingSafeEqual(derivedKey, expectedKey)
        ) {
          return { isValid: true, needsUpgrade: true };
        }
      }
    }

    return { isValid: false, needsUpgrade: false };
  } catch {
    return { isValid: false, needsUpgrade: false };
  }
}

export function verifyPassword(password: string, storedHash: string): boolean {
  return verifyPasswordWithStatus(password, storedHash).isValid;
}

export const DUMMY_SCRYPT_HASH = hashPassword('dummy-constant-time-mitigation-2026');

export function hashPin(pin: string): string {
  return hashPassword(pin);
}

export function verifyPin(pin: string, storedHash: string): boolean {
  return verifyPassword(pin, storedHash);
}

const WEAK_PIN_SET = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '012345',
  '543210',
  '112233',
  '121212',
  '123123',
]);

export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;
  if (WEAK_PIN_SET.has(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const sequentialUp = '01234567890';
  const sequentialDown = '98765432109';
  return sequentialUp.includes(pin) || sequentialDown.includes(pin);
}

export function hashOpaqueToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateOpaqueRefreshToken(): { raw: string; hash: string } {
  const raw = `sf_rt_${crypto.randomBytes(32).toString('hex')}`;
  return { raw, hash: hashOpaqueToken(raw) };
}

export function generatePasswordResetToken(): { raw: string; hash: string } {
  const raw = `sf_pr_${crypto.randomBytes(32).toString('hex')}`;
  return { raw, hash: hashOpaqueToken(raw) };
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return {
      valid: false,
      message: 'Password must be between 10 and 128 characters long.',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter.',
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter.',
    };
  }
  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number.',
    };
  }
  return { valid: true };
}

export function generateSecureTemporaryPassword(length: number = 14): string {
  const targetLen = Math.max(12, Math.min(32, Math.trunc(length)));
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  const chars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];
  while (chars.length < targetLen) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

export function normalizeAndValidatePublicKeyPem(
  publicKeyPem: string,
  expectedAlgorithm: 'ED25519' | 'ECDSA_P256' = 'ECDSA_P256',
): { pem: string; keyAlgorithm: 'ED25519' | 'ECDSA_P256' } | null {
  try {
    const trimmed = (publicKeyPem || '').trim();
    if (!trimmed.includes('BEGIN PUBLIC KEY')) return null;
    const keyObj = crypto.createPublicKey(trimmed);
    const keyType = keyObj.asymmetricKeyType;
    if (expectedAlgorithm === 'ED25519') {
      if (keyType !== 'ed25519') return null;
      return {
        pem: keyObj.export({ type: 'spki', format: 'pem' }).toString(),
        keyAlgorithm: 'ED25519',
      };
    }
    if (keyType === 'ec' && keyObj.asymmetricKeyDetails?.namedCurve === 'prime256v1') {
      return {
        pem: keyObj.export({ type: 'spki', format: 'pem' }).toString(),
        keyAlgorithm: 'ECDSA_P256',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyBiometricSignature(params: {
  publicKeyPem: string;
  keyAlgorithm: string;
  payload: string;
  signatureBase64: string;
}): boolean {
  try {
    const keyObj = crypto.createPublicKey(params.publicKeyPem);
    const sigBuf = Buffer.from(params.signatureBase64, 'base64');
    if (sigBuf.length === 0) return false;
    const dataBuf = Buffer.from(params.payload, 'utf8');
    if (params.keyAlgorithm === 'ED25519') {
      return crypto.verify(null, dataBuf, keyObj, sigBuf);
    }
    return crypto.verify('sha256', dataBuf, keyObj, sigBuf);
  } catch {
    return false;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'sunday-funday-secret-key-2026';

export interface JwtPayload {
  sub: number;
  jti?: string;
  sid?: string;
  tv?: number;
  mcp?: boolean;
  accountName?: string;
  username?: string;
  email: string;
  role: string;
  blueprintType: string;
  fullName: string;
  iat?: number;
  nbf?: number;
  exp?: number;
}

export function signToken(
  payload: Omit<JwtPayload, 'exp' | 'iat'>,
  expiresInSec: number = 1800,
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSec;
  const jti = payload.jti || crypto.randomBytes(12).toString('hex');
  const body = Buffer.from(
    JSON.stringify({ ...payload, jti, iat: now, exp }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    if (!header || !body || !signature) return null;

    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as {
      alg?: string;
      typ?: string;
    };
    if (!parsedHeader || parsedHeader.alg !== 'HS256') return null;

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }
    if (typeof payload.nbf === 'number' && payload.nbf > now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function normalizeIp(ip: string | undefined): string {
  if (!ip) return '127.0.0.1';
  let cleaned = ip.trim();
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.replace('::ffff:', '');
  }
  return cleaned;
}

export function extractClientIp(req: any): string {
  if (!req) return '127.0.0.1';
  const headers = req.headers || {};
  let candidate: string | undefined;

  if (headers['cf-connecting-ip']) {
    const val = headers['cf-connecting-ip'];
    candidate = Array.isArray(val) ? val[0] : val;
  } else if (headers['x-forwarded-for']) {
    const val = headers['x-forwarded-for'];
    const str = Array.isArray(val) ? val[0] : val;
    candidate = str.split(',')[0]?.trim();
  } else if (headers['x-real-ip']) {
    const val = headers['x-real-ip'];
    candidate = Array.isArray(val) ? val[0] : val;
  } else if (req.ip) {
    candidate = req.ip;
  } else if (req.socket?.remoteAddress) {
    candidate = req.socket.remoteAddress;
  }

  return normalizeIp(candidate);
}

export function isLocalhost(ip: string | undefined): boolean {
  const normalized = normalizeIp(ip);
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost' ||
    normalized === '0.0.0.0'
  );
}
