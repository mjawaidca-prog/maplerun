/**
 * AES-256-GCM field-level encryption for PII (SIN, bank details).
 *
 * Key is read from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Never log encrypted values or the key.
 *
 * Format stored in DB:  <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *   IV:      12 bytes (96 bits) random — GCM standard
 *   AuthTag: 16 bytes (128 bits)
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // bytes
const AUTH_TAG_LENGTH = 16; // bytes
const KEY_LENGTH = 32; // bytes (256 bits)

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "Missing ENCRYPTION_KEY environment variable. Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${hex.length} chars.`
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string. Returns `<iv>:<authTag>:<ciphertext>` (all hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypt an encrypted value produced by `encrypt()`.
 * Throws if the auth tag doesn't match (tampered or wrong key).
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format. Expected iv:authTag:ciphertext.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Hash a SIN for lookup/comparison without storing plaintext.
 * Uses SHA-256 with the encryption key as HMAC. Deterministic per key.
 */
export function hashSIN(sin: string): string {
  const key = getKey();
  return crypto.createHmac("sha256", key).update(sin).digest("hex");
}
