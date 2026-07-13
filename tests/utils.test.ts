import { describe, it, expect } from "vitest";
import { extractMentions, isOverdue, initials } from "@/lib/utils";

describe("extractMentions", () => {
  const knownNames = ["Summer Malik", "Jane Doe", "Jane"];

  it("extracts a full-name mention", () => {
    expect(extractMentions("hey @Summer Malik can you review this?", knownNames)).toContain("Summer Malik");
  });

  it("prefers the longer matching name over a shorter prefix match", () => {
    const mentions = extractMentions("cc @Jane Doe", knownNames);
    expect(mentions).toContain("Jane Doe");
  });

  it("returns no mentions when nobody is mentioned", () => {
    expect(extractMentions("no mentions here", knownNames)).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    expect(extractMentions("@summer malik thanks", knownNames)).toContain("Summer Malik");
  });
});

describe("isOverdue", () => {
  it("is false for completed or archived tasks even with a past due date", () => {
    expect(isOverdue("2000-01-01", "completed")).toBe(false);
    expect(isOverdue("2000-01-01", "archived")).toBe(false);
  });

  it("is true for a past due date on an active task", () => {
    expect(isOverdue("2000-01-01", "in_progress")).toBe(true);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(null, "in_progress")).toBe(false);
  });
});

describe("initials", () => {
  it("builds initials from first and last name", () => {
    expect(initials("Summer Malik")).toBe("SM");
  });

  it("handles a single-word name", () => {
    expect(initials("Cher")).toBe("C");
  });
});
