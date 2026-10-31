import { render, screen } from "@testing-library/react";
import PrivacyPage, {
  DELETION_REQUEST_WINDOW,
  PRIVACY_EFFECTIVE_DATE,
  metadata,
} from "./page";
import { SUPPORT_EMAIL } from "@/lib/support-email";

describe("PrivacyPage", () => {
  it("exports a static document title", () => {
    expect(metadata.title).toEqual({
      absolute: "Privacy Policy · Receipt Splitter",
    });
    expect(metadata.description).toMatch(/how long it is kept/i);
  });

  it("explains processing, retention, and that parsing needs the server", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What we process" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Who processes it" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/OpenAI or OpenRouter/)).toBeInTheDocument();
    expect(screen.getByText(/Firecrawl fetches the page/)).toBeInTheDocument();
    expect(screen.getByText(/public web address/)).toBeInTheDocument();
    expect(screen.getByText(/UploadThing/)).toBeInTheDocument();
    expect(screen.getByText(/same id/)).toBeInTheDocument();
    expect(screen.getByText(/raw IP is not copied/)).toBeInTheDocument();
    expect(screen.getByText(/Speed Insights/)).toBeInTheDocument();
    expect(screen.getByText(/StoreKit/)).toBeInTheDocument();
    expect(screen.getByText(/90 days/)).toBeInTheDocument();
    expect(screen.getAllByText(/New Split/).length).toBeGreaterThan(0);
    expect(screen.getByText(/App Tracking Transparency/)).toBeInTheDocument();
    expect(screen.getByText(/Parsing needs the server/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PRIVACY_EFFECTIVE_DATE))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`within ${DELETION_REQUEST_WINDOW}`)),
    ).toBeInTheDocument();
    expect(screen.getAllByText(SUPPORT_EMAIL).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "support page" })).toHaveAttribute(
      "href",
      "/support",
    );
  });
});
