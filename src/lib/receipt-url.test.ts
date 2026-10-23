import { normalizeReceiptUrl } from "./receipt-url";

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
