/**
 * Password-based AES-GCM encryption for sketch / source files.
 * On-disk format (UTF-8 text):
 *   AETHERENC1
 *   <base64 salt>.<base64 iv>.<base64 ciphertext>
 */

export const ENC_MAGIC = "AETHERENC1";

const PBKDF2_ITERS = 210_000;
const SALT_LEN = 16;
const IV_LEN = 12;

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isEncryptedPayload(content: string): boolean {
  return content.startsWith(`${ENC_MAGIC}\n`) || content.startsWith(`${ENC_MAGIC}\r\n`);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const saltBuf = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuf,
      iterations: PBKDF2_ITERS,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSketch(
  plaintext: string,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENC_MAGIC}\n${b64encode(salt)}.${b64encode(iv)}.${b64encode(cipher)}\n`;
}

export async function decryptSketch(
  payload: string,
  password: string,
): Promise<string> {
  const body = payload.replace(/^\uFEFF?AETHERENC1\r?\n/, "").trim();
  const parts = body.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted sketch format.");
  }
  const [saltB64, ivB64, dataB64] = parts;
  const salt = b64decode(saltB64!);
  const iv = b64decode(ivB64!);
  const data = b64decode(dataB64!);
  const key = await deriveKey(password, salt);
  const ivBuf = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength,
  ) as ArrayBuffer;
  const dataBuf = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf },
      key,
      dataBuf,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Wrong password or corrupted file.");
  }
}

/** In-memory passwords for encrypted tabs (never persisted). */
const passwordVault = new Map<string, string>();

export function rememberSketchPassword(path: string, password: string) {
  passwordVault.set(path, password);
}

export function forgetSketchPassword(path: string) {
  passwordVault.delete(path);
}

export function getSketchPassword(path: string): string | undefined {
  return passwordVault.get(path);
}
