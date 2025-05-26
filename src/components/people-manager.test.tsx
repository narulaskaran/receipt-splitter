import { render, screen, fireEvent } from "@testing-library/react";
import { PeopleManager } from "./people-manager";
import { toast } from "sonner";
import { mockPeople, setupGlobalMocks } from "@/test/test-utils";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

beforeAll(() => {
  setupGlobalMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

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
    fireEvent.change(screen.getByPlaceholderText(/add a person/i), {
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
    fireEvent.change(screen.getByPlaceholderText(/add a person/i), {
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

  it("shows error when trying to add empty name", () => {
    render(<PeopleManager people={[]} onPeopleChange={() => {}} />);
    const input = screen.getByPlaceholderText(/add a person/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(toast.error).toHaveBeenCalledWith("Please enter a name");
  });
});
