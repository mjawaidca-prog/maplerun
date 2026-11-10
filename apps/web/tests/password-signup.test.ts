import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  verifyCredentials,
  validateRegistration,
  normalizeEmail,
  type CredentialUserLookup,
} from "../src/lib/credentials";

describe("hashPassword / verifyPassword", () => {
  it("round-trips: a hash verifies against its own password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("scrypt:16384:8:1:")).toBe(true);
    await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse batter", stored)).resolves.toBe(false);
  });

  it("salts every hash — the same password hashes differently twice", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same-password", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password", b)).resolves.toBe(true);
  });

  it("rejects missing and malformed stored values", async () => {
    await expect(verifyPassword("x", null)).resolves.toBe(false);
    await expect(verifyPassword("x", undefined)).resolves.toBe(false);
    await expect(verifyPassword("x", "")).resolves.toBe(false);
    await expect(verifyPassword("x", "bcrypt:10:whatever")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt:16384:8:1")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt:abc:8:1:AA==:AA==")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt:999999999:8:1:AA==:AA==")).resolves.toBe(false);
  });

  it("rejects a tampered hash", async () => {
    const stored = await hashPassword("topsecret1");
    const parts = stored.split(":");
    const hash = Buffer.from(parts[5], "base64");
    hash[0] = hash[0] ^ 0xff;
    parts[5] = hash.toString("base64");
    await expect(verifyPassword("topsecret1", parts.join(":"))).resolves.toBe(false);
  });
});

function fakeLookup(
  record: { id: string; email: string; name: string | null; passwordHash: string | null } | null,
  seen?: string[],
): CredentialUserLookup {
  return async (email: string) => {
    seen?.push(email);
    return record && record.email === email ? record : null;
  };
}

describe("verifyCredentials", () => {
  it("returns the user for a correct email + password", async () => {
    const passwordHash = await hashPassword("hunter2-hunter");
    const lookup = fakeLookup({ id: "u1", email: "syed@example.com", name: "Syed", passwordHash });
    await expect(verifyCredentials("syed@example.com", "hunter2-hunter", lookup)).resolves.toEqual({
      id: "u1",
      email: "syed@example.com",
      name: "Syed",
    });
  });

  it("normalizes the email before lookup (case + whitespace)", async () => {
    const passwordHash = await hashPassword("hunter2-hunter");
    const seen: string[] = [];
    const lookup = fakeLookup({ id: "u1", email: "syed@example.com", name: null, passwordHash }, seen);
    const result = await verifyCredentials("  Syed@Example.COM ", "hunter2-hunter", lookup);
    expect(seen).toEqual(["syed@example.com"]);
    expect(result?.id).toBe("u1");
  });

  it("returns null for a wrong password", async () => {
    const passwordHash = await hashPassword("hunter2-hunter");
    const lookup = fakeLookup({ id: "u1", email: "a@b.co", name: null, passwordHash });
    await expect(verifyCredentials("a@b.co", "hunter2-hunteR", lookup)).resolves.toBeNull();
  });

  it("returns null for an unknown email", async () => {
    const lookup = fakeLookup(null);
    await expect(verifyCredentials("ghost@example.com", "whatever1", lookup)).resolves.toBeNull();
  });

  it("returns null when the account has no password (magic-link-only user)", async () => {
    const lookup = fakeLookup({ id: "u2", email: "link@example.com", name: "Link", passwordHash: null });
    await expect(verifyCredentials("link@example.com", "whatever1", lookup)).resolves.toBeNull();
  });

  it("returns null for empty inputs without calling the lookup", async () => {
    let called = false;
    const lookup: CredentialUserLookup = async () => { called = true; return null; };
    await expect(verifyCredentials("", "x", lookup)).resolves.toBeNull();
    await expect(verifyCredentials("a@b.co", "", lookup)).resolves.toBeNull();
    expect(called).toBe(false);
  });
});

describe("validateRegistration", () => {
  it("accepts valid input and normalizes name + email", () => {
    const r = validateRegistration({ name: "  Syed Abbas ", email: " Syed@Example.com ", password: "password1" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Syed Abbas", email: "syed@example.com", password: "password1" },
    });
  });

  it("rejects a missing or one-character name", () => {
    expect(validateRegistration({ name: "", email: "a@b.co", password: "password1" }).ok).toBe(false);
    expect(validateRegistration({ name: "J", email: "a@b.co", password: "password1" }).ok).toBe(false);
    expect(validateRegistration({ email: "a@b.co", password: "password1" }).ok).toBe(false);
  });

  it("rejects malformed emails", () => {
    for (const email of ["", "not-an-email", "a@b", "a b@c.co", "@x.co"]) {
      expect(validateRegistration({ name: "Valid Name", email, password: "password1" }).ok).toBe(false);
    }
  });

  it("enforces the password length window (8–128)", () => {
    expect(validateRegistration({ name: "Valid Name", email: "a@b.co", password: "1234567" }).ok).toBe(false);
    expect(validateRegistration({ name: "Valid Name", email: "a@b.co", password: "12345678" }).ok).toBe(true);
    expect(validateRegistration({ name: "Valid Name", email: "a@b.co", password: "x".repeat(129) }).ok).toBe(false);
  });

  it("rejects non-string fields", () => {
    expect(validateRegistration({ name: 42, email: "a@b.co", password: "password1" }).ok).toBe(false);
    expect(validateRegistration({ name: "Valid Name", email: null, password: "password1" }).ok).toBe(false);
    expect(validateRegistration({ name: "Valid Name", email: "a@b.co", password: undefined }).ok).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.CA ")).toBe("foo@bar.ca");
  });
});
