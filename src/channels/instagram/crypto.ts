/**
 * Secure AES-256-GCM token encryption and decryption at rest.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/config/env";

export interface EncryptedPayload {
  readonly encryptedData: string; // hex
  readonly iv: string; // hex
  readonly authTag: string; // hex
}

function getKeyBuffer(): Buffer {
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
}

/**
 * Encrypts a plain text token with AES-256-GCM using a random 12-byte IV.
 */
export function encryptToken(token: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKeyBuffer(), iv);

  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 * Throws an error if ciphertext or auth tag is corrupted/tampered.
 */
export function decryptToken(payload: EncryptedPayload): string {
  const decipher = createDecipheriv("aes-256-gcm", getKeyBuffer(), Buffer.from(payload.iv, "hex"));

  decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedData, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
