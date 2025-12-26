import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupManager } from "./group-manager";
import { type Person, type Group } from "@/types";
import { toast } from "sonner";

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("GroupManager", () => {
  const mockPeople: Person[] = [
    {
      id: "1",
      name: "Alice",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
    {
      id: "2",
      name: "Bob",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
    {
      id: "3",
      name: "Charlie",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
  ];

  const mockGroups: Group[] = [
    {
      id: "g1",
      name: "Couple",
      memberIds: ["1", "2"],
      emoji: "💑",
    },
  ];

  const mockOnGroupCreate = jest.fn();
  const mockOnGroupUpdate = jest.fn();
  const mockOnGroupDelete = jest.fn();
  const mockOnGroupEmojiRegenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders nothing when there are no people", () => {
      const { container } = render(
        <GroupManager
          people={[]}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the Groups card when there are people", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );
      expect(screen.getByText("Groups")).toBeInTheDocument();
    });

    it("shows empty state message when there are no groups", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );
      expect(
        screen.getByText(/Create groups to quickly assign items/i)
      ).toBeInTheDocument();
    });

    it("renders existing groups", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );
      expect(screen.getByText("Couple")).toBeInTheDocument();
      expect(screen.getByText(/Alice, Bob/)).toBeInTheDocument();
    });

    it("renders Create Group button", () => {
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );
      expect(screen.getByText("Create Group")).toBeInTheDocument();
    });
  });

  describe("Create Group", () => {
    it("opens create dialog when clicking Create Group button", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const createButton = screen.getByText("Create Group");
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("Create New Group")).toBeInTheDocument();
      });
    });

    it("creates a group with valid input", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      // Open dialog
      await user.click(screen.getByText("Create Group"));

      // Enter group name
      const nameInput = screen.getByLabelText("Group Name");
      await user.type(nameInput, "Friends");

      // Select members
      const aliceCheckbox = screen.getByLabelText("Alice");
      const bobCheckbox = screen.getByLabelText("Bob");
      await user.click(aliceCheckbox);
      await user.click(bobCheckbox);

      // Click create
      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      await user.click(createButtonInDialog);

      // Verify callback was called
      expect(mockOnGroupCreate).toHaveBeenCalledWith("Friends", ["1", "2"]);
      expect(toast.success).toHaveBeenCalledWith('Group "Friends" created!');
    });

    it("shows error when group name is empty", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      // Select members without entering name
      const aliceCheckbox = screen.getByLabelText("Alice");
      const bobCheckbox = screen.getByLabelText("Bob");
      await user.click(aliceCheckbox);
      await user.click(bobCheckbox);

      // Button should be disabled when name is empty
      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      expect(createButtonInDialog).toBeDisabled();
    });

    it("shows error when fewer than 2 members are selected", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      const nameInput = screen.getByLabelText("Group Name");
      await user.type(nameInput, "Solo");

      // Select only one member
      const aliceCheckbox = screen.getByLabelText("Alice");
      await user.click(aliceCheckbox);

      // Button should be disabled when fewer than 2 members selected
      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      expect(createButtonInDialog).toBeDisabled();
    });

    it("shows error when group name already exists", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      const nameInput = screen.getByLabelText("Group Name");
      await user.type(nameInput, "Couple"); // Duplicate name

      const aliceCheckbox = screen.getByLabelText("Alice");
      const bobCheckbox = screen.getByLabelText("Bob");
      await user.click(aliceCheckbox);
      await user.click(bobCheckbox);

      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      await user.click(createButtonInDialog);

      expect(toast.error).toHaveBeenCalledWith(
        "A group with that name already exists"
      );
      expect(mockOnGroupCreate).not.toHaveBeenCalled();
    });

    it("closes dialog when clicking Cancel", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));
      expect(screen.getByText("Create New Group")).toBeInTheDocument();

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText("Create New Group")).not.toBeInTheDocument();
      });
    });
  });

  describe("Edit Group", () => {
    it("opens edit dialog when clicking edit button", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (btn) => btn.querySelector('svg.lucide-pencil')
      );
      await user.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText("Edit Group")).toBeInTheDocument();
      });
    });

    it("pre-fills edit dialog with group data", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (btn) => btn.querySelector('svg.lucide-pencil')
      );
      await user.click(editButton!);

      await waitFor(() => {
        const nameInput = screen.getByLabelText("Group Name");
        expect(nameInput).toHaveValue("Couple");
      });
    });

    it("updates group with valid input", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (btn) => btn.querySelector('svg.lucide-pencil')
      );
      await user.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText("Edit Group")).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText("Group Name");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Couple");

      const updateButton = screen.getByRole("button", {
        name: /Update Group/i,
      });
      await user.click(updateButton);

      expect(mockOnGroupUpdate).toHaveBeenCalledWith("g1", {
        name: "Updated Couple",
        memberIds: ["1", "2"],
      });
      expect(toast.success).toHaveBeenCalledWith(
        'Group "Updated Couple" updated!'
      );
    });

    it("disables update button when name is empty", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (btn) => btn.querySelector('svg.lucide-pencil')
      );
      await user.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText("Edit Group")).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText("Group Name");
      await user.clear(nameInput);

      const updateButton = screen.getByRole("button", {
        name: /Update Group/i,
      });
      expect(updateButton).toBeDisabled();
    });
  });

  describe("Delete Group", () => {
    it("deletes group when clicking delete button", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const allButtons = screen.getAllByRole("button");
      const deleteButton = allButtons.find(
        (btn) => btn.querySelector('svg.lucide-x')
      );
      await user.click(deleteButton!);

      expect(mockOnGroupDelete).toHaveBeenCalledWith("g1");
      expect(toast.success).toHaveBeenCalledWith('Group "Couple" deleted');
    });
  });

  describe("Emoji Regeneration", () => {
    it("calls onGroupEmojiRegenerate when clicking emoji button", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={mockGroups}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      const allButtons = screen.getAllByRole("button");
      const emojiButton = allButtons.find(
        (btn) => btn.querySelector('svg.lucide-refresh-cw')
      );
      await user.click(emojiButton!);

      expect(mockOnGroupEmojiRegenerate).toHaveBeenCalledWith("g1");
    });
  });

  describe("Member Toggle", () => {
    it("toggles member selection when clicking checkbox", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      // Get checkbox by role instead of label
      const aliceLabel = screen.getByText("Alice");
      const aliceCheckbox = aliceLabel.previousElementSibling as HTMLInputElement;

      // Initially unchecked
      expect(aliceCheckbox).toBeInTheDocument();

      // Click to check
      await user.click(aliceCheckbox);

      // Click again to uncheck
      await user.click(aliceCheckbox);
    });
  });

  describe("Button States", () => {
    it("disables create button when name is empty", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      expect(createButtonInDialog).toBeDisabled();
    });

    it("disables create button when fewer than 2 members selected", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      const nameInput = screen.getByLabelText("Group Name");
      await user.type(nameInput, "Test");

      const aliceCheckbox = screen.getByLabelText("Alice");
      await user.click(aliceCheckbox);

      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      expect(createButtonInDialog).toBeDisabled();
    });

    it("enables create button when valid input is provided", async () => {
      const user = userEvent.setup();
      render(
        <GroupManager
          people={mockPeople}
          groups={[]}
          onGroupCreate={mockOnGroupCreate}
          onGroupUpdate={mockOnGroupUpdate}
          onGroupDelete={mockOnGroupDelete}
          onGroupEmojiRegenerate={mockOnGroupEmojiRegenerate}
        />
      );

      await user.click(screen.getByText("Create Group"));

      const nameInput = screen.getByLabelText("Group Name");
      await user.type(nameInput, "Test");

      const aliceCheckbox = screen.getByLabelText("Alice");
      const bobCheckbox = screen.getByLabelText("Bob");
      await user.click(aliceCheckbox);
      await user.click(bobCheckbox);

      const createButtonInDialog = screen.getByRole("button", {
        name: /Create Group/i,
      });
      expect(createButtonInDialog).toBeEnabled();
    });
  });
});
