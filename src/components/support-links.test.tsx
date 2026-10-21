import { render, screen } from "@testing-library/react";
import { SupportFooter, SupportBanner, KOFI_URL } from "./support-links";

describe("SupportFooter", () => {
  it("renders the tagline without a Ko-fi link", () => {
    render(<SupportFooter />);
    expect(screen.getByText("Free to use. No sign-up.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
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

describe("SupportBanner", () => {
  it("renders the default one-line prompt and a Ko-fi link", () => {
    render(<SupportBanner />);
    expect(
      screen.getByText("Free to use. A coffee helps cover our costs.")
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /tip/i });
    expect(link).toHaveAttribute("href", KOFI_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders custom text", () => {
    render(<SupportBanner>Saved you some math?</SupportBanner>);
    expect(screen.getByText("Saved you some math?")).toBeInTheDocument();
  });
});
