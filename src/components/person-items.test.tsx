import { render, screen } from "@testing-library/react";
import { PersonItems } from "./person-items";
import { mockPeople } from "@/test/test-utils";

describe("PersonItems", () => {
  it("renders person names", () => {
    render(<PersonItems people={mockPeople} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });
});
