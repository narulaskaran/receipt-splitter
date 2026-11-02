import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_FALLBACK,
  isSupportEmailAddress,
  supportEmailFrom,
} from "./support-email";

describe("supportEmailFrom", () => {
  it("uses the App Store listing placeholder when no address is configured", () => {
    expect(supportEmailFrom(undefined)).toBe(SUPPORT_EMAIL_FALLBACK);
    expect(supportEmailFrom("")).toBe(SUPPORT_EMAIL_FALLBACK);
    expect(supportEmailFrom("   ")).toBe(SUPPORT_EMAIL_FALLBACK);
  });

  it("keeps a configured address", () => {
    expect(supportEmailFrom("  help@example.com  ")).toBe("help@example.com");
  });
});

describe("SUPPORT_EMAIL", () => {
  it("is the placeholder or a configured address, never a made-up mailbox", () => {
    if (process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()) {
      expect(SUPPORT_EMAIL).toBe(process.env.NEXT_PUBLIC_SUPPORT_EMAIL.trim());
    } else {
      expect(SUPPORT_EMAIL).toBe(SUPPORT_EMAIL_FALLBACK);
    }
    expect(SUPPORT_EMAIL).not.toMatch(/@receiptsplitter/i);
  });
});

describe("isSupportEmailAddress", () => {
  it("accepts a plain address and rejects the placeholder sentence", () => {
    expect(isSupportEmailAddress("help@example.com")).toBe(true);
    expect(isSupportEmailAddress(SUPPORT_EMAIL_FALLBACK)).toBe(false);
  });
});
