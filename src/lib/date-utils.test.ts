import { formatDisplayDate, parseDateString } from "./date-utils";

describe("parseDateString", () => {
  it("parses YYYY-MM-DD as a local calendar date", () => {
    const date = parseDateString("2026-08-20");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(20);
  });

  it("returns null for invalid dates", () => {
    expect(parseDateString("invalid-date")).toBeNull();
  });
});

describe("formatDisplayDate", () => {
  it("formats ISO dates without timezone shift", () => {
    expect(formatDisplayDate("2026-08-20")).toBe("Thu, Aug 20, 2026");
    expect(formatDisplayDate("2024-12-25")).toBe("Wed, Dec 25, 2024");
  });

  it("returns the original string when parsing fails", () => {
    expect(formatDisplayDate("invalid-date")).toBe("invalid-date");
  });
});
