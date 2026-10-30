import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiConsentDialog } from "@/components/ai-consent-dialog";
import { getPublicShareOrigin } from "@/lib/app-config";

describe("AiConsentDialog", () => {
  it("explains the AI send and links to privacy and support", async () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    render(<AiConsentDialog open onAccept={onAccept} onDecline={onDecline} />);

    expect(screen.getByRole("dialog")).toHaveTextContent(/anthropic by default/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/90 days/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/ip address/i);

    const origin = getPublicShareOrigin();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "href",
      `${origin}/privacy`
    );
    expect(screen.getByRole("link", { name: /support/i })).toHaveAttribute(
      "href",
      `${origin}/support`
    );

    await userEvent.click(screen.getByRole("button", { name: /agree and continue/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /don't send/i }));
    expect(onDecline).toHaveBeenCalled();
  });
});
