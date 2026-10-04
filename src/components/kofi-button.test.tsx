import { render, screen } from "@testing-library/react";
import { KofiButton } from "./kofi-button";

describe("KofiButton", () => {
  it("renders the Ko-fi link", () => {
    render(<KofiButton />);
    const link = screen.getByRole("link", { name: /buy me a coffee/i });
    expect(link).toHaveAttribute("href", "https://ko-fi.com/Y8Y21CC8IA");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
