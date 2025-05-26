import { render, screen } from "@testing-library/react";
import { KofiButton } from "./kofi-button";

describe("KofiButton", () => {
  it("renders the Ko-fi link and image", () => {
    render(<KofiButton />);
    const link = screen.getByRole("link", { name: /buy me a coffee/i });
    expect(link).toHaveAttribute("href", "https://ko-fi.com/Y8Y21CC8IA");
    const img = screen.getByAltText(/buy me a coffee at ko-fi.com/i);
    expect(img).toBeInTheDocument();
  });
});
