import { render, screen, fireEvent } from "@testing-library/react";
import { PeopleManager } from "./people-manager";
import { toast } from "sonner";
import { mockPeople } from "@/test/test-utils";

describe("PeopleManager", () => {
  it("renders add person button", () => {
    render(<PeopleManager people={[]} onPeopleChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /add person/i })
    ).toBeInTheDocument();
  });

  it("adds a person when input is filled and button is clicked", () => {
    const handleChange = jest.fn();
    render(<PeopleManager people={[]} onPeopleChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add person/i }));
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "Alice" })])
    );
  });

  it("prevents adding duplicate names", () => {
    const handleChange = jest.fn();
    render(
      <PeopleManager
        people={[
          {
            id: "1",
            name: "Alice",
            items: [],
            totalBeforeTax: 0,
            tax: 0,
            tip: 0,
            finalTotal: 0,
          },
        ]}
        onPeopleChange={handleChange}
      />
    );
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add person/i }));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("removes a person when remove button is clicked", () => {
    const handleChange = jest.fn();
    render(
      <PeopleManager people={[mockPeople[0]]} onPeopleChange={handleChange} />
    );
    fireEvent.click(screen.getByLabelText(/remove alice/i));
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it("adds several comma-separated names at once and skips duplicates", () => {
    const handleChange = jest.fn();
    render(
      <PeopleManager people={[mockPeople[0]]} onPeopleChange={handleChange} />
    );
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: `Dana, ${mockPeople[0].name}, Eli,` },
    });
    fireEvent.click(screen.getByRole("button", { name: /add person/i }));
    const next = handleChange.mock.calls[0][0];
    expect(next.map((p: { name: string }) => p.name)).toEqual([
      mockPeople[0].name,
      "Dana",
      "Eli",
    ]);
    expect(toast.error).toHaveBeenCalledWith(
      "A person with that name already exists"
    );
  });

  it("shows error when trying to add empty name", () => {
    render(<PeopleManager people={[]} onPeopleChange={() => {}} />);
    const input = screen.getByRole("textbox", { name: /name/i });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(toast.error).toHaveBeenCalledWith("Please enter a name");
  });
});
