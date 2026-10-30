import { render, screen } from "@testing-library/react";
import SupportPage, { metadata } from "./page";
import { SUPPORT_EMAIL } from "@/lib/support-email";

describe("SupportPage", () => {
  it("exports a static document title", () => {
    expect(metadata.title).toEqual({
      absolute: "Support · Receipt Splitter",
    });
  });

  it("explains the split flow, offline editing, and links to the privacy policy", () => {
    render(<SupportPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Support" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Capture, split, and share" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Offline editing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Tips on iPhone" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Camera or photos permission" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Can't reach the server" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A receipt link failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot parse a receipt on the device/)).toBeInTheDocument();
    expect(screen.getByText(/Venmo is optional/)).toBeInTheDocument();
    expect(screen.getAllByText(SUPPORT_EMAIL).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
