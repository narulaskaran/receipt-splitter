import { type Person } from "@/types";
import {
  deserializeSplitData,
  generateShareableUrl,
  MAX_SHARE_URL_LENGTH,
  serializeSplitData,
  SplitDataError,
  validateSplitDataDetailed,
  type SharedReceiptBreakdown,
} from "./split-sharing";

/**
 * Frozen share URLs. These strings are the on-the-wire format from before
 * phone became optional. They must keep deserializing to the same data.
 */
const LEGACY_MAJOR_UNIT_NO_CURRENCY_URL =
  "https://receipt-splitter.app/split?names=I%2CK%2Cp%2Cs&amounts=15.25%2C21.75%2C15.25%2C15.25&total=67.52&note=Love+Mama&phone=5551234567&date=2025-09-05";

const LEGACY_MINOR_UNIT_NO_CURRENCY_URL =
  "https://receipt-splitter.app/split?names=Alice%2CBob&amounts=3250%2C1950&total=5200&note=Pizza+Palace&phone=5551234567&date=2024-01-15";

const LEGACY_MINOR_UNIT_RECEIPTS_URL =
  "https://receipt-splitter.app/split?names=Alice%2CBob&amounts=3000%2C2000&total=5000&note=Dinner+Split&phone=5551234567&currency=USD&receipts=%5B%7B%22label%22%3A%22Cafe%22%2C%22amounts%22%3A%5B1200%2C800%5D%7D%2C%7B%22label%22%3A%22Dessert+Bar%22%2C%22amounts%22%3A%5B1800%2C1200%5D%7D%5D";

const LEGACY_MAJOR_UNIT_RECEIPTS_NO_CURRENCY_URL =
  "https://receipt-splitter.app/split?names=Alice%2CBob&amounts=30.00%2C20.00&total=50.00&note=Dinner+Split&phone=5551234567&receipts=%5B%7B%22label%22%3A%22Cafe%22%2C%22amounts%22%3A%5B12.5%2C7.5%5D%7D%2C%7B%22label%22%3A%22Dessert+Bar%22%2C%22amounts%22%3A%5B17.5%2C12.5%5D%7D%5D";

const LEGACY_FORMATTED_PHONE_URL =
  "https://receipt-splitter.app/split?names=Alice&amounts=25.00&total=25.00&note=Lunch&phone=555-123-4567";

const LEGACY_INVALID_PHONE_URL =
  "https://receipt-splitter.app/split?names=Alice&amounts=30.00&total=30.00&note=Lunch&phone=123";

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

const usdPeople: Person[] = [
  {
    id: "1",
    name: "Alice",
    items: [],
    totalBeforeTax: 32.5,
    tax: 0,
    tip: 0,
    finalTotal: 32.5,
  },
  {
    id: "2",
    name: "Bob",
    items: [],
    totalBeforeTax: 19.5,
    tax: 0,
    tip: 0,
    finalTotal: 19.5,
  },
];

const jpyPeople: Person[] = [
  {
    id: "1",
    name: "Alice",
    items: [],
    totalBeforeTax: 1250,
    tax: 0,
    tip: 0,
    finalTotal: 1250,
  },
  {
    id: "2",
    name: "Bob",
    items: [],
    totalBeforeTax: 1000,
    tax: 0,
    tip: 0,
    finalTotal: 1000,
  },
];

const krwPeople: Person[] = [
  {
    id: "1",
    name: "Alice",
    items: [],
    totalBeforeTax: 18750,
    tax: 0,
    tip: 0,
    finalTotal: 18750,
  },
  {
    id: "2",
    name: "Bob",
    items: [],
    totalBeforeTax: 15000,
    tax: 0,
    tip: 0,
    finalTotal: 15000,
  },
];

describe("legacy share URLs", () => {
  it("deserializes a major-unit link with a phone and no currency", () => {
    const data = deserializeSplitData(paramsOf(LEGACY_MAJOR_UNIT_NO_CURRENCY_URL));

    expect(data).toEqual({
      names: ["I", "K", "p", "s"],
      amounts: [15.25, 21.75, 15.25, 15.25],
      total: 67.52,
      note: "Love Mama",
      phone: "5551234567",
      currency: "USD",
      date: "2025-09-05",
    });
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
  });

  it("deserializes a minor-unit link with a phone and no currency", () => {
    const data = deserializeSplitData(paramsOf(LEGACY_MINOR_UNIT_NO_CURRENCY_URL));

    expect(data).toEqual({
      names: ["Alice", "Bob"],
      amounts: [32.5, 19.5],
      total: 52,
      note: "Pizza Palace",
      phone: "5551234567",
      currency: "USD",
      date: "2024-01-15",
    });
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
  });

  it("deserializes a minor-unit multi-receipt payload", () => {
    const data = deserializeSplitData(paramsOf(LEGACY_MINOR_UNIT_RECEIPTS_URL));

    expect(data).toEqual({
      names: ["Alice", "Bob"],
      amounts: [30, 20],
      total: 50,
      note: "Dinner Split",
      phone: "5551234567",
      currency: "USD",
      date: undefined,
      receipts: [
        { label: "Cafe", amounts: [12, 8] },
        { label: "Dessert Bar", amounts: [18, 12] },
      ],
    });
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
  });

  it("deserializes a major-unit multi-receipt link with no currency", () => {
    const data = deserializeSplitData(
      paramsOf(LEGACY_MAJOR_UNIT_RECEIPTS_NO_CURRENCY_URL)
    );

    expect(data).toEqual({
      names: ["Alice", "Bob"],
      amounts: [30, 20],
      total: 50,
      note: "Dinner Split",
      phone: "5551234567",
      currency: "USD",
      date: undefined,
      receipts: [
        { label: "Cafe", amounts: [12.5, 7.5] },
        { label: "Dessert Bar", amounts: [17.5, 12.5] },
      ],
    });
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
  });

  it("returns a formatted phone unchanged", () => {
    const data = deserializeSplitData(paramsOf(LEGACY_FORMATTED_PHONE_URL));

    expect(data?.phone).toBe("555-123-4567");
    expect(data?.amounts).toEqual([25]);
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
  });

  it("still returns a present invalid phone so validation rejects it", () => {
    const data = deserializeSplitData(paramsOf(LEGACY_INVALID_PHONE_URL));

    expect(data).not.toBeNull();
    expect(data!.phone).toBe("123");
    const validation = validateSplitDataDetailed(data!);
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
    expect(validation.errorMessages[0]).toContain(
      "Phone number '123' format is invalid"
    );
  });
});

describe("sharing without a phone", () => {
  function roundTrip(
    people: Person[],
    note: string,
    currency: string,
    receipts?: SharedReceiptBreakdown[]
  ) {
    const params = serializeSplitData(
      people,
      note,
      null,
      currency,
      null,
      receipts
    );
    expect(params.has("phone")).toBe(false);

    const url = generateShareableUrl(
      "https://receipt-splitter.app",
      people,
      note,
      undefined,
      currency,
      null,
      receipts
    );
    expect(url.startsWith("https://receipt-splitter.app/split?")).toBe(true);
    expect(new URL(url).searchParams.has("phone")).toBe(false);
    expect(url.length).toBeLessThanOrEqual(MAX_SHARE_URL_LENGTH);

    const data = deserializeSplitData(new URL(url).searchParams);
    expect(data).not.toBeNull();
    expect(data!.phone).toBeUndefined();
    expect(data!.currency).toBe(currency);
    expect(data!.note).toBe(note);
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
    return data!;
  }

  it("round-trips USD with no phone", () => {
    const data = roundTrip(usdPeople, "Pizza Palace", "USD");
    expect(data.names).toEqual(["Alice", "Bob"]);
    expect(data.amounts).toEqual([32.5, 19.5]);
    expect(data.total).toBe(52);
  });

  it("round-trips JPY zero-decimal amounts with no phone", () => {
    const data = roundTrip(jpyPeople, "Sushi", "JPY");
    expect(data.amounts).toEqual([1250, 1000]);
    expect(data.total).toBe(2250);
    expect(new URL(
      generateShareableUrl(
        "https://receipt-splitter.app",
        jpyPeople,
        "Sushi",
        "",
        "JPY"
      )
    ).searchParams.get("amounts")).toBe("1250,1000");
  });

  it("round-trips EUR with no phone", () => {
    const data = roundTrip(usdPeople, "Bistro", "EUR");
    expect(data.amounts).toEqual([32.5, 19.5]);
    expect(data.total).toBe(52);
  });

  it("round-trips KRW zero-decimal amounts with no phone", () => {
    const data = roundTrip(krwPeople, "Korean BBQ", "KRW");
    expect(data.amounts).toEqual([18750, 15000]);
    expect(data.total).toBe(33750);
  });

  it("round-trips a multi-receipt split with no phone", () => {
    const receipts: SharedReceiptBreakdown[] = [
      { label: "Cafe", amounts: [12.5, 7.5] },
      { label: "Dessert Bar", amounts: [20, 12] },
    ];
    const data = roundTrip(usdPeople, "Dinner", "USD", receipts);
    expect(data.receipts).toEqual(receipts);
    expect(data.amounts).toEqual([32.5, 19.5]);
  });

  it("drops oversized itemization so a no-phone URL stays within 8000 characters", () => {
    const people: Person[] = [
      ...usdPeople,
      {
        id: "3",
        name: "Charlie",
        items: [],
        totalBeforeTax: 13,
        tax: 0,
        tip: 0,
        finalTotal: 13,
      },
    ];
    const oversized: SharedReceiptBreakdown[] = Array.from(
      { length: 50 },
      (_, index) => ({
        label: `Restaurant ${index} ${"x".repeat(65)} & Café`,
        amounts: [0.65, 0.39, 0.26],
      })
    );

    const raw = serializeSplitData(
      people,
      "Receipt Split",
      null,
      "USD",
      null,
      oversized
    );
    expect(raw.get("receipts")).not.toBeNull();
    expect(raw.has("phone")).toBe(false);

    const url = generateShareableUrl(
      "https://receipt-splitter.app",
      people,
      "Receipt Split",
      "   ",
      "USD",
      null,
      oversized
    );

    expect(url.length).toBeLessThanOrEqual(MAX_SHARE_URL_LENGTH);
    expect(url).not.toContain("receipts=");
    expect(new URL(url).searchParams.has("phone")).toBe(false);
    const data = deserializeSplitData(new URL(url).searchParams);
    expect(data).not.toBeNull();
    expect(data!.phone).toBeUndefined();
    expect(data!.receipts).toBeUndefined();
    expect(validateSplitDataDetailed(data!).isValid).toBe(true);
  });
});
