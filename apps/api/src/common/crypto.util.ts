import * as crypto from 'crypto';

function deriveAesKey(): Buffer {
  const secret =
    process.env.MARQUEE_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'sunday-funday-erp-local-aes-key-2026';
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Encrypts a sensitive credential string using AES-256-GCM with a random 96-bit IV.
 * Format: v1:<ivHex>:<authTagHex>:<ciphertextHex>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const key = deriveAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a `v1:<ivHex>:<authTagHex>:<ciphertextHex>` secret encrypted by `encryptSecret`.
 */
export function decryptSecret(payload: string): string {
  if (!payload) return '';
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted secret envelope format.');
  }
  const [, ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Corrupted encryption envelope dimensions.');
  }

  const key = deriveAesKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskSecretPreview(plaintext: string): string {
  if (!plaintext) return '';
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}

export function generateMarqueeToken(): string {
  return `mrq_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashSecretToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function verifySecretToken(rawToken: string, expectedHashHex: string): boolean {
  if (!rawToken || !expectedHashHex || !/^[a-f0-9]{64}$/i.test(expectedHashHex)) {
    return false;
  }
  const actualBuf = Buffer.from(hashSecretToken(rawToken), 'hex');
  const expectedBuf = Buffer.from(expectedHashHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
