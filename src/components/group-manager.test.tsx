import { render, screen, fireEvent, within } from "@testing-library/react";
import { GroupManager } from "./group-manager";
import { toast } from "sonner";
import { mockPeople, setupGlobalMocks } from "@/test/test-utils";
import { type Group } from "@/types";

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

beforeAll(() => {
  setupGlobalMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const mockGroups: Group[] = [
  {
    id: "group-1",
    name: "Couples",
    emoji: "👫",
    memberIds: ["1", "2"],
  },
  {
    id: "group-2",
    name: "Friends",
    emoji: "👥",
    memberIds: ["3", "4"],
  },
];

describe("GroupManager", () => {
  describe("Rendering", () => {
    it("returns null when no people are available", () => {
      const { container } = render(
        <GroupManager
          people={[]}
          groups={[]}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders create group button when people exist", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: /create group/i })
      ).toBeInTheDocument();
    });

    it("shows helpful message when no groups exist", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      expect(
        screen.getByText(/create groups to quickly assign items/i)
      ).toBeInTheDocument();
    });

    it("renders existing groups with emoji and members", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      expect(screen.getByText("Couples")).toBeInTheDocument();
      expect(screen.getByText("Friends")).toBeInTheDocument();
      expect(screen.getByText("👫")).toBeInTheDocument();
      expect(screen.getByText("👥")).toBeInTheDocument();
    });

    it("handles undefined groups prop gracefully", () => {
      render(
        <GroupManager
          people={mockPeople}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      expect(
        screen.getByText(/create groups to quickly assign items/i)
      ).toBeInTheDocument();
    });
  });

  describe("Creating Groups", () => {
    it("opens create dialog when create button is clicked", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /create group/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Create New Group")).toBeInTheDocument();
    });

    it("calls onGroupCreate with correct data when group is created", () => {
      const handleCreate = jest.fn();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={handleCreate}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /create group/i }));

      const dialog = screen.getByRole("dialog");
      const input = within(dialog).getByRole("textbox");
      fireEvent.change(input, { target: { value: "Test Group" } });

      const checkboxes = within(dialog).getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      const buttons = within(dialog).getAllByRole("button");
      const createButton = buttons.find(b => b.textContent?.includes("Create Group"));
      fireEvent.click(createButton!);

      expect(handleCreate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });

    it("shows error when trying to create duplicate group name", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /create group/i }));

      const dialog = screen.getByRole("dialog");
      const input = within(dialog).getByRole("textbox");
      fireEvent.change(input, { target: { value: "Couples" } });

      const checkboxes = within(dialog).getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      const buttons = within(dialog).getAllByRole("button");
      const createButton = buttons.find(b => b.textContent?.includes("Create Group"));
      fireEvent.click(createButton!);

      expect(toast.error).toHaveBeenCalledWith(
        "A group with that name already exists"
      );
    });

    it("disables create button when name is empty", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /create group/i }));

      const dialog = screen.getByRole("dialog");
      const checkboxes = within(dialog).getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      const buttons = within(dialog).getAllByRole("button");
      const createButton = buttons.find(b => b.textContent?.includes("Create Group"));
      expect(createButton).toBeDisabled();
    });
  });

  describe("Editing Groups", () => {
    it("calls onGroupUpdate when group is updated", () => {
      const handleUpdate = jest.fn();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={jest.fn()}
          onGroupUpdate={handleUpdate}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );

      const allButtons = screen.getAllByRole("button");
      const editButtons = allButtons.filter(b => b.querySelector('svg.lucide-pencil'));
      fireEvent.click(editButtons[0]);

      const dialog = screen.getByRole("dialog");
      const buttons = within(dialog).getAllByRole("button");
      const updateButton = buttons.find(b => b.textContent?.includes("Update Group"));
      fireEvent.click(updateButton!);

      expect(handleUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe("Deleting Groups", () => {
    it("calls onGroupDelete when delete button is clicked", () => {
      const handleDelete = jest.fn();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={handleDelete}
          onGroupEmojiRegenerate={jest.fn()}
        />
      );

      const allButtons = screen.getAllByRole("button");
      const deleteButtons = allButtons.filter(b => b.querySelector('svg.lucide-x'));
      fireEvent.click(deleteButtons[0]);

      expect(handleDelete).toHaveBeenCalledWith("group-1");
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe("Emoji Regeneration", () => {
    it("calls onGroupEmojiRegenerate when emoji button is clicked", () => {
      const handleRegenerate = jest.fn();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={jest.fn()}
          onGroupUpdate={jest.fn()}
          onGroupDelete={jest.fn()}
          onGroupEmojiRegenerate={handleRegenerate}
        />
      );

      const allButtons = screen.getAllByRole("button");
      const regenButtons = allButtons.filter(b => b.querySelector('svg.lucide-refresh-cw'));
      fireEvent.click(regenButtons[0]);

      expect(handleRegenerate).toHaveBeenCalledWith("group-1");
    });
  });
});
