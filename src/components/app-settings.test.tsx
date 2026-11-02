import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getPublicShareOrigin } from "@/lib/app-config";
import { setPlatform, webPlatform } from "@/lib/platform";

import { AppSettings } from "./app-settings";

afterEach(() => {
  setPlatform(webPlatform);
});

describe("AppSettings", () => {
  it("opens a sheet with theme, privacy policy, and support", async () => {
    const user = userEvent.setup();
    const openExternalUrl = jest.fn(async () => "opened" as const);
    setPlatform({
      ...webPlatform,
      kind: "ios",
      isNative: true,
      showKofi: false,
      tips: null,
      openExternalUrl,
    });

    render(<AppSettings />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Privacy policy" }));
    await user.click(screen.getByRole("button", { name: "Support" }));
    expect(openExternalUrl).toHaveBeenNthCalledWith(1, `${getPublicShareOrigin()}/privacy`);
    expect(openExternalUrl).toHaveBeenNthCalledWith(2, `${getPublicShareOrigin()}/support`);
  });
});
