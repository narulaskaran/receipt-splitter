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

  it("says what is processed, how long it is kept, and how to ask for deletion", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What we process" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/third-party service providers/)).toBeInTheDocument();
    expect(screen.getByText(/We may change providers/)).toBeInTheDocument();
    expect(screen.getByText(/web address can/)).toBeInTheDocument();
    expect(screen.getByText(/random session id/)).toBeInTheDocument();
    expect(screen.getByText(/up to 90 days/)).toBeInTheDocument();
    expect(screen.getByText(/New Split clears it/)).toBeInTheDocument();
    expect(screen.getByText(/no ads/)).toBeInTheDocument();
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

  it("does not name vendors, so providers can change without a policy edit", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).not.toMatch(
      /Anthropic|OpenAI|OpenRouter|Firecrawl|UploadThing|Vercel|Slack/,
    );
  });
});
