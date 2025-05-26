import { render, screen } from "@testing-library/react";
import { ReceiptDetails } from "./receipt-details";
import { mockReceipt } from "@/test/test-utils";

describe("ReceiptDetails", () => {
  it("renders receipt name and formatted date", () => {
    render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={() => {}} />);
    expect(screen.getByText(/Testaurant/)).toBeInTheDocument();
    expect(screen.getByText("2024-01-01")).toBeInTheDocument();
  });
});
