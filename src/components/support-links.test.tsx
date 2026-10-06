import { render, screen } from "@testing-library/react";
import { SupportFooter, SupportCard, KOFI_URL } from "./support-links";

describe("SupportFooter", () => {
  it("renders a Ko-fi link that opens in a new tab", () => {
    render(<SupportFooter />);
    const link = screen.getByRole("link", { name: /support on ko-fi/i });
    expect(link).toHaveAttribute("href", KOFI_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders children alongside the support text", () => {
    render(
      <SupportFooter>
        <button type="button">Extra</button>
      </SupportFooter>
    );
    expect(screen.getByRole("button", { name: "Extra" })).toBeInTheDocument();
  });
});

describe("SupportCard", () => {
  it("renders the prompt and a Ko-fi button link", () => {
    render(<SupportCard />);
    expect(screen.getByText(/saved you some math/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /buy me a coffee/i });
    expect(link).toHaveAttribute("href", KOFI_URL);
    expect(link).toHaveAttribute("target", "_blank");
  });
});
