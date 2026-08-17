const {
  MOCK_RECEIPT,
  MOCK_COFFEE_RECEIPT,
  MOCK_LUNCH_RECEIPT,
  MOCK_PEOPLE,
  itemsTotal,
} = require("./screenshot-fixtures");

describe("screenshot harness fixtures", () => {
  it("Lunch line items sum to the stated subtotal", () => {
    expect(itemsTotal(MOCK_RECEIPT)).toBeCloseTo(MOCK_RECEIPT.subtotal, 2);
    expect(itemsTotal(MOCK_LUNCH_RECEIPT)).toBeCloseTo(
      MOCK_LUNCH_RECEIPT.subtotal,
      2
    );
    expect(MOCK_LUNCH_RECEIPT.subtotal).toBe(45);
  });

  it("Coffee line items sum to the stated subtotal", () => {
    expect(itemsTotal(MOCK_COFFEE_RECEIPT)).toBeCloseTo(
      MOCK_COFFEE_RECEIPT.subtotal,
      2
    );
  });

  it("subtotal + tax + tip equals total for each receipt", () => {
    for (const receipt of [
      MOCK_RECEIPT,
      MOCK_COFFEE_RECEIPT,
      MOCK_LUNCH_RECEIPT,
    ]) {
      expect(receipt.subtotal + receipt.tax + receipt.tip).toBeCloseTo(
        receipt.total,
        2
      );
    }
  });

  it("Lunch person pre-tax totals sum to the Lunch subtotal", () => {
    const peopleSubtotal = MOCK_PEOPLE.reduce(
      (sum: number, person: { totalBeforeTax: number }) =>
        sum + person.totalBeforeTax,
      0
    );
    expect(peopleSubtotal).toBeCloseTo(MOCK_RECEIPT.subtotal, 2);
  });

  it("Lunch person finals sum to the Lunch total", () => {
    const peopleTotal = MOCK_PEOPLE.reduce(
      (sum: number, person: { finalTotal: number }) => sum + person.finalTotal,
      0
    );
    expect(peopleTotal).toBeCloseTo(MOCK_RECEIPT.total, 2);
  });
});
