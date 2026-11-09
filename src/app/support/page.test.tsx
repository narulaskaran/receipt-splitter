import { render, screen } from "@testing-library/react";
import SupportPage, { metadata } from "./page";
import { SUPPORT_EMAIL } from "@/lib/support-email";

describe("SupportPage", () => {
  it("exports a static document title", () => {
    expect(metadata.title).toEqual({
      absolute: "Support · Receipt Splitter",
    });
  });

  it("gives a way to contact us and links to the privacy policy", () => {
    render(<SupportPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Support" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getAllByText(SUPPORT_EMAIL).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
