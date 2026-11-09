import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SplitScreen } from "@/components/split-screen";

describe("SplitScreen", () => {
  it("renders a valid split from URLSearchParams", async () => {
    render(
      <SplitScreen
        searchParams={new URLSearchParams(
          "names=Jon,Jane&amounts=10.00,20.00&total=30.00&note=Lunch&phone=5551234567"
        )}
        onCreateNew={jest.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: "Lunch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("uses the home link render prop and the create-new callback", async () => {
    const onCreateNew = jest.fn();
    const { rerender } = render(
      <SplitScreen
        searchParams={new URLSearchParams("names=A")}
        onCreateNew={onCreateNew}
      />
    );

    expect(await screen.findByText(/unable to load split/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /create new split/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);

    rerender(
      <SplitScreen
        searchParams={new URLSearchParams("names=A")}
        renderHomeLink={({ children, className }) => (
          <a href="#/" className={className}>
            {children}
          </a>
        )}
      />
    );

    expect(screen.getByRole("link", { name: /create new split/i })).toHaveAttribute(
      "href",
      "#/"
    );
  });
});
