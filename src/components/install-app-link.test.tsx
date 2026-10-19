import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallAppLink } from "./install-app-link";

function fireBeforeInstallPrompt() {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: jest.Mock;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("InstallAppLink", () => {
  afterEach(() => {
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    jest.restoreAllMocks();
  });

  it("renders nothing when the app can't be installed", () => {
    const { container } = render(<InstallAppLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("triggers the browser install prompt when the app is installable", async () => {
    render(<InstallAppLink />);
    const event = fireBeforeInstallPrompt();

    await userEvent.click(await screen.findByRole("button", { name: /install app/i }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /install app/i })).not.toBeInTheDocument()
    );
  });

  it("explains Add to Home Screen on iOS", async () => {
    jest
      .spyOn(window.navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    render(<InstallAppLink />);

    await userEvent.click(await screen.findByRole("button", { name: /install app/i }));

    expect(
      await screen.findByRole("dialog", { name: /add to home screen/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/share menu/i)).toBeInTheDocument();
    expect(screen.getByText(/open it in safari first/i)).toBeInTheDocument();
  });
});
