import {
  receiptCollisionNumber,
  receiptDisplayName,
  receiptRestaurantName,
  receiptSubtitle,
  UNTITLED_RECEIPT_NAME,
} from "./receipt-labels";
import { createMockReceipt, createStoredReceipt } from "@/test/test-utils";

describe("receiptRestaurantName", () => {
  it("returns the restaurant name", () => {
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: "Cafe" }),
      "a"
    );
    expect(receiptRestaurantName(stored)).toBe("Cafe");
  });

  it("falls back to Untitled receipt for null or blank names", () => {
    const missing = createStoredReceipt(
      createMockReceipt({ restaurant: null }),
      "a"
    );
    const blank = createStoredReceipt(
      createMockReceipt({ restaurant: "   " }),
      "b"
    );
    expect(receiptRestaurantName(missing)).toBe(UNTITLED_RECEIPT_NAME);
    expect(receiptRestaurantName(blank)).toBe(UNTITLED_RECEIPT_NAME);
  });
});

describe("receiptSubtitle", () => {
  it("shows the date when the restaurant name is unique", () => {
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: "Cafe", date: "2024-03-15" }),
      "a"
    );
    expect(receiptSubtitle(stored, [stored])).toBe("2024-03-15");
  });

  it("omits the subtitle when a unique receipt has no date", () => {
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: "Cafe", date: null }),
      "a"
    );
    expect(receiptSubtitle(stored, [stored])).toBeUndefined();
  });

  it("always keeps the date and adds #n when names collide", () => {
    const morning = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "a"
    );
    const evening = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "b"
    );
    const receipts = [morning, evening];
    expect(receiptSubtitle(morning, receipts)).toBe("2024-01-01 · #1");
    expect(receiptSubtitle(evening, receipts)).toBe("2024-01-01 · #2");
  });

  it("still shows each receipt's date plus #n when collision dates differ", () => {
    const first = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "a"
    );
    const second = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-02" }),
      "b"
    );
    const receipts = [first, second];
    expect(receiptSubtitle(first, receipts)).toBe("2024-01-01 · #1");
    expect(receiptSubtitle(second, receipts)).toBe("2024-01-02 · #2");
  });

  it("numbers collisions among duplicate titles, not the full list", () => {
    const coffee1 = createStoredReceipt(
      createMockReceipt({ restaurant: "Coffee", date: "2024-01-01" }),
      "a"
    );
    const lunch = createStoredReceipt(
      createMockReceipt({ restaurant: "Lunch", date: "2024-01-02" }),
      "x"
    );
    const coffee2 = createStoredReceipt(
      createMockReceipt({ restaurant: "Coffee", date: "2024-01-01" }),
      "b"
    );
    const receipts = [coffee1, lunch, coffee2];
    expect(receiptSubtitle(lunch, receipts)).toBe("2024-01-02");
    expect(receiptSubtitle(coffee1, receipts)).toBe("2024-01-01 · #1");
    expect(receiptSubtitle(coffee2, receipts)).toBe("2024-01-01 · #2");
  });

  it("shows only #n when colliding receipts have no date", () => {
    const first = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: null }),
      "a"
    );
    const second = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: null }),
      "b"
    );
    expect(receiptSubtitle(first, [first, second])).toBe("#1");
    expect(receiptSubtitle(second, [first, second])).toBe("#2");
  });
});

describe("receiptDisplayName", () => {
  it("falls back to Untitled receipt", () => {
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: null }),
      "a"
    );
    expect(receiptDisplayName(stored, [stored])).toBe(UNTITLED_RECEIPT_NAME);
  });

  it("uses the restaurant name when it is unique", () => {
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: "Cafe", date: "2024-03-15" }),
      "a"
    );
    expect(receiptDisplayName(stored, [stored])).toBe("Cafe");
  });

  it("adds date and #n when names collide", () => {
    const first = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "a"
    );
    const second = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-02" }),
      "b"
    );
    expect(receiptDisplayName(first, [first, second])).toBe(
      "Starbucks · 2024-01-01 · #1"
    );
    expect(receiptDisplayName(second, [first, second])).toBe(
      "Starbucks · 2024-01-02 · #2"
    );
  });

  it("keeps the date and adds #n when name and date both collide", () => {
    const first = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "a"
    );
    const second = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "b"
    );
    expect(receiptDisplayName(first, [first, second])).toBe(
      "Starbucks · 2024-01-01 · #1"
    );
    expect(receiptDisplayName(second, [first, second])).toBe(
      "Starbucks · 2024-01-01 · #2"
    );
  });
});

describe("receiptCollisionNumber", () => {
  it("is null when the name is unique", () => {
    const stored = createStoredReceipt(createMockReceipt(), "a");
    expect(receiptCollisionNumber(stored, [stored])).toBeNull();
  });
});
