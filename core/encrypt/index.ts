import * as crypto from "crypto";
import keytar from "keytar";

// Configuration
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

export async function encrypt(plain: string, key?: Buffer): Promise<string> {
  if (!key) {
    key = await getOrCreateKey();
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from("additional-data"));

  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export async function decrypt(b64: string, key?: Buffer): Promise<string> {
  if (!key) {
    key = await getOrCreateKey();
  }

  const buf = Buffer.from(b64, "base64");

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from("additional-data"));
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8"
  );
}

const SERVICE = "tome";
const ACCOUNT = "encryption-key";

export async function getOrCreateKey(): Promise<Buffer> {
  let keyBase64 = await keytar.getPassword(SERVICE, ACCOUNT);

  if (!keyBase64) {
    const newKey = crypto.randomBytes(KEY_LENGTH);
    keyBase64 = newKey.toString("base64");
    await keytar.setPassword(SERVICE, ACCOUNT, keyBase64);
    return newKey;
  }

  return Buffer.from(keyBase64, "base64");
}
