import { describe, it, expect } from "vitest";
import {
  hashAccessCode,
  verifyAccessCode,
  normalizeName,
  isValidAccessCodeFormat,
  generateSessionToken,
  hashSessionToken,
  safeEqual,
  DUMMY_CODE_HASH,
} from "@/lib/crypto";

describe("access code hashing", () => {
  it("hashes a code so the plaintext never appears in the hash", async () => {
    const hash = await hashAccessCode("4821");
    expect(hash).not.toContain("4821");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt hash prefix
  });

  it("verifies a matching code and rejects a non-matching one", async () => {
    const hash = await hashAccessCode("4821");
    expect(await verifyAccessCode("4821", hash)).toBe(true);
    expect(await verifyAccessCode("9999", hash)).toBe(false);
  });

  it("produces a different hash each time (bcrypt salting)", async () => {
    const hashA = await hashAccessCode("1234");
    const hashB = await hashAccessCode("1234");
    expect(hashA).not.toBe(hashB);
  });

  it("exposes a dummy hash for constant-time comparisons against unknown members", async () => {
    expect(await verifyAccessCode("0000", DUMMY_CODE_HASH)).toBe(true);
    expect(await verifyAccessCode("1234", DUMMY_CODE_HASH)).toBe(false);
  });
});

describe("isValidAccessCodeFormat", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidAccessCodeFormat("4821")).toBe(true);
    expect(isValidAccessCodeFormat("0000")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidAccessCodeFormat("482")).toBe(false);
    expect(isValidAccessCodeFormat("48212")).toBe(false);
    expect(isValidAccessCodeFormat("abcd")).toBe(false);
    expect(isValidAccessCodeFormat("48 21")).toBe(false);
    expect(isValidAccessCodeFormat("")).toBe(false);
  });
});

describe("normalizeName", () => {
  it("trims, lowercases, and collapses internal whitespace for login lookups", () => {
    expect(normalizeName("  Summer   Malik ")).toBe("summer malik");
    expect(normalizeName("Summer Malik")).toBe("summer malik");
    expect(normalizeName("SUMMER MALIK")).toBe("summer malik");
  });

  it("treats differently-cased or spaced names as the same login identity", () => {
    expect(normalizeName("Jane Doe")).toBe(normalizeName("  jane   DOE  "));
  });
});

describe("session tokens", () => {
  it("generates unique, sufficiently long opaque tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes a token deterministically so lookups by hash are possible", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });
});

describe("safeEqual", () => {
  it("compares strings correctly regardless of length mismatch", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
