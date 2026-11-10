/**
 * Password hashing for legacy Auth.js password sign-in — Node's built-in
 * scrypt (no new dependency). Hashes are self-describing:
 *
 *   scrypt:<N>:<r>:<p>:<salt base64>:<derived key base64>
 *
 * so cost parameters can be raised later without invalidating old hashes.
 * N=16384 / r=8 / p=1 is the OWASP-recommended minimum for interactive
 * logins (~16 MiB memory, tens of milliseconds per attempt).
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Callback wrapper — util.promisify's scrypt typing in @types/node does
// not accept the options argument, so promisify it by hand.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

// Upper bound accepted when verifying a stored hash, so a corrupted or
// crafted value can never make verification allocate absurd memory.
const MAX_N = 2 ** 20;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, KEYLEN, {
    N,
    r: R,
    p: P,
  }));
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join(":");
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    n <= 1 ||
    n > MAX_N ||
    r <= 0 ||
    p <= 0
  ) {
    return false;
  }

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = (await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
    }));
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
