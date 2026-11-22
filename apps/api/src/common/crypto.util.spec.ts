import {
  decryptSecret,
  encryptSecret,
  generateMarqueeToken,
  hashSecretToken,
  maskSecretPreview,
  verifySecretToken,
} from './crypto.util';

describe('CryptoUtil (AES-256-GCM & Webhook Token Verification)', () => {
  it('encrypts and decrypts UTF-8 API keys cleanly round-trip', () => {
    const original = 'AIzaSyTest-Gemini-Key-2026-9988';
    const cipher = encryptSecret(original);
    expect(cipher).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    expect(cipher).not.toContain('AIzaSy');
    expect(decryptSecret(cipher)).toBe(original);
  });

  it('produces unique random IV ciphertexts for identical plaintext inputs', () => {
    const a = encryptSecret('gsk_identical_secret_value');
    const b = encryptSecret('gsk_identical_secret_value');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('gsk_identical_secret_value');
    expect(decryptSecret(b)).toBe('gsk_identical_secret_value');
  });

  it('throws on tampered ciphertext or authentication tag', () => {
    const valid = encryptSecret('gsk_sensitive_token_1234');
    const parts = valid.split(':');
    const tamperedCipher =
      parts[3].slice(0, -2) + (parts[3].endsWith('aa') ? 'bb' : 'aa');
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCipher}`;
    expect(() => decryptSecret(tamperedPayload)).toThrow();
  });

  it('handles empty string cleanly for optional keys', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
    expect(maskSecretPreview('')).toBe('');
  });

  it('generates mrq_ tokens, deterministic SHA-256 hashes, and timing-safe checks', () => {
    const raw = generateMarqueeToken();
    expect(raw.startsWith('mrq_')).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(36);

    const hash = hashSecretToken(raw);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifySecretToken(raw, hash)).toBe(true);
    expect(verifySecretToken(`${raw}x`, hash)).toBe(false);
    expect(verifySecretToken('invalid', hash)).toBe(false);
  });
});
