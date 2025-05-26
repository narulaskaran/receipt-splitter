import { render, screen } from "@testing-library/react";
import { ReceiptDetails } from "./receipt-details";
import { type Receipt } from "@/types";

describe("ReceiptDetails", () => {
  const receipt: Receipt = {
    restaurant: "Testaurant",
    date: "2024-01-01",
    subtotal: 100,
    tax: 10,
    tip: 15,
    total: 125,
    items: [
      { name: "Burger", price: 50, quantity: 1 },
      { name: "Fries", price: 25, quantity: 2 },
    ],
  };
  it("renders receipt name and formatted date", () => {
    render(<ReceiptDetails receipt={receipt} onReceiptUpdate={() => {}} />);
    expect(screen.getByText(/Testaurant/)).toBeInTheDocument();
    expect(screen.getByText("12/31/2023")).toBeInTheDocument();
  });
});
