import { render, screen } from "@testing-library/react";

import { setPlatform, webPlatform, type TipProduct } from "@/lib/platform";

import { SupportFooter, SupportBanner, KOFI_URL } from "./support-links";

afterEach(() => {
  setPlatform(webPlatform);
});

describe("SupportFooter", () => {
  it("renders the tagline without a Ko-fi link", () => {
    render(<SupportFooter />);
    expect(screen.getByText("Free to use. No sign-up.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /tip/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ko-fi/i })).not.toBeInTheDocument();
  });

  it("links Privacy and Support on the web", () => {
    render(<SupportFooter />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/support",
    );
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

  it("replaces the Ko-fi anchor with the tip jar when Ko-fi is hidden", () => {
    const products: TipProduct[] = [];
    setPlatform({
      ...webPlatform,
      kind: "ios",
      isNative: true,
      showKofi: false,
      tips: {
        loadProducts: jest.fn(async () => products),
        purchase: jest.fn(async () => ({ status: "cancelled" as const })),
      },
    });

    render(<SupportBanner />);
    expect(screen.queryByRole("link", { name: /tip/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ko-fi/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave a tip" })).toBeInTheDocument();
    expect(screen.getByText("Free to use. A coffee helps cover our costs.")).toBeInTheDocument();
  });
});
