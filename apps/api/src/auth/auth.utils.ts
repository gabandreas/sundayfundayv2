import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export function getUserIdOrThrow(req: any): number {
  const userId = req?.user?.id || req?.userId || (process.env.NODE_ENV === 'test' ? 1 : null);
  if (!userId) {
    throw new UnauthorizedException('Authentication required.');
  }
  return userId;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey, 'hex'));
  } catch {
    return false;
  }
}

export function hashPin(pin: string): string {
  return hashPassword(pin);
}

export function verifyPin(pin: string, storedHash: string): boolean {
  return verifyPassword(pin, storedHash);
}

const JWT_SECRET = process.env.JWT_SECRET || 'sunday-funday-secret-key-2026';

export interface JwtPayload {
  sub: number;
  accountName?: string;
  username?: string;
  email: string;
  role: string;
  blueprintType: string;
  fullName: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'exp' | 'iat'>, expiresInSec: number = 1800): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSec;
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
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

  // 1. cf-connecting-ip (Cloudflare)
  if (headers['cf-connecting-ip']) {
    const val = headers['cf-connecting-ip'];
    candidate = Array.isArray(val) ? val[0] : val;
  }
  // 2. first IP in x-forwarded-for (Standard proxies)
  else if (headers['x-forwarded-for']) {
    const val = headers['x-forwarded-for'];
    const str = Array.isArray(val) ? val[0] : val;
    candidate = str.split(',')[0]?.trim();
  }
  // 3. x-real-ip (Nginx)
  else if (headers['x-real-ip']) {
    const val = headers['x-real-ip'];
    candidate = Array.isArray(val) ? val[0] : val;
  }
  // 4. req.ip or req.socket.remoteAddress (Direct / local)
  else if (req.ip) {
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

