import { normalizeReceiptUrl, neutralizeInvalidReceiptLink } from "./receipt-url";

describe("normalizeReceiptUrl", () => {
  it("accepts http and https links", () => {
    expect(
      normalizeReceiptUrl("https://www.toasttab.com/receipts/J--Wt/nkthf")
    ).toBe("https://www.toasttab.com/receipts/J--Wt/nkthf");
    expect(normalizeReceiptUrl("http://example.com/r")).toBe("http://example.com/r");
  });

  it("trims whitespace and adds a missing https scheme", () => {
    expect(normalizeReceiptUrl("  toasttab.com/receipts/abc \n")).toBe(
      "https://toasttab.com/receipts/abc"
    );
  });

  it.each([
    "",
    "   ",
    "my receipt from lunch",
    "lunch",
    "localhost",
    "ftp://example.com/receipt",
    "javascript:alert(1)",
    "https://user:pass@example.com/r",
    "https://",
    "https://example.com/a b",
    `https://example.com/${"a".repeat(2100)}`,
  ])("rejects %j", (input) => {
    expect(normalizeReceiptUrl(input)).toBeNull();
  });
});

describe("neutralizeInvalidReceiptLink", () => {
  it("strips Slack mrkdwn and control characters", () => {
    const raw = "x\n<!channel> <https://evil.example|open>";
    const out = neutralizeInvalidReceiptLink(raw);
    expect(out).not.toMatch(/[<>|\n]/);
    expect(out.startsWith("invalid link:")).toBe(true);
  });

  it("returns a fixed label when nothing remains", () => {
    expect(neutralizeInvalidReceiptLink("<<<")).toBe("invalid link");
  });

  it("caps long input", () => {
    const out = neutralizeInvalidReceiptLink("a".repeat(300));
    expect(out.length).toBeLessThanOrEqual("invalid link: ".length + 200);
  });
});
