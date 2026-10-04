import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type Person, type Group } from "@/types";
import { toast } from "sonner";

interface GroupManagerProps {
  people: Person[];
  groups?: Group[];
  onGroupCreate: (name: string, memberIds: string[]) => void;
  onGroupUpdate: (groupId: string, updates: Partial<Group>) => void;
  onGroupDelete: (groupId: string) => void;
  onGroupEmojiRegenerate: (groupId: string) => void;
}

export function GroupManager({
  people,
  groups = [],
  onGroupCreate,
  onGroupUpdate,
  onGroupDelete,
  onGroupEmojiRegenerate,
}: GroupManagerProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set()
  );

  // Open create dialog
  const openCreateDialog = () => {
    setGroupName("");
    setSelectedMembers(new Set());
    setCreateDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (group: Group) => {
    setCurrentGroup(group);
    setGroupName(group.name);
    setSelectedMembers(new Set(group.memberIds));
    setEditDialogOpen(true);
  };

  // Close dialogs
  const closeDialogs = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setCurrentGroup(null);
    setGroupName("");
    setSelectedMembers(new Set());
  };

  // Toggle member selection
  const toggleMember = (personId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    setSelectedMembers(newSelected);
  };

  // Create group
  const handleCreate = () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      toast.error("Please enter a group name");
      return;
    }

    if (
      groups &&
      groups.some((g) => g.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      toast.error("A group with that name already exists");
      return;
    }

    if (selectedMembers.size < 2) {
      toast.error("Please select at least 2 members for a group");
      return;
    }

    onGroupCreate(trimmedName, Array.from(selectedMembers));
    toast.success(`Group "${trimmedName}" created!`);
    closeDialogs();
  };

  // Update group
  const handleUpdate = () => {
    if (!currentGroup) return;

    const trimmedName = groupName.trim();

    if (!trimmedName) {
      toast.error("Please enter a group name");
      return;
    }

    if (
      groups &&
      groups.some(
        (g) =>
          g.id !== currentGroup.id &&
          g.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      toast.error("A group with that name already exists");
      return;
    }

    if (selectedMembers.size < 2) {
      toast.error("Please select at least 2 members for a group");
      return;
    }

    onGroupUpdate(currentGroup.id, {
      name: trimmedName,
      memberIds: Array.from(selectedMembers),
    });
    toast.success(`Group "${trimmedName}" updated!`);
    closeDialogs();
  };

  // Delete group
  const handleDelete = (group: Group) => {
    onGroupDelete(group.id);
    toast.success(`Group "${group.name}" deleted`);
  };

  // Get person name by ID
  const getPersonName = (personId: string): string => {
    return people.find((p) => p.id === personId)?.name || "Unknown";
  };

  // Handle key down for group name input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editDialogOpen) {
        handleUpdate();
      } else {
        handleCreate();
      }
    }
  };

  if (people.length === 0) {
    return null; // Don't show groups section if no people
  }

  const dialogOpen = createDialogOpen || editDialogOpen;
  const memberIdPrefix = editDialogOpen ? "edit" : "create";

  return (
    <section aria-labelledby="groups-heading" className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="groups-heading" className="text-sm font-medium">
            Groups <span className="font-normal text-muted-foreground">(optional)</span>
          </h3>
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Create groups to quickly assign items to multiple people, like a couple sharing a dish.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openCreateDialog}
          className="shrink-0"
          aria-label="Create group"
        >
          <Plus />
          <span className="hidden sm:inline">Create group</span>
        </Button>
      </div>

      {groups.length > 0 && (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-1"
            >
              <button
                type="button"
                onClick={() => onGroupEmojiRegenerate(group.id)}
                title="Change emoji"
                aria-label={`Change emoji for ${group.name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-md text-xl hover:bg-accent"
              >
                <span aria-hidden="true">{group.emoji || "👥"}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{group.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {group.memberIds.map((id) => getPersonName(id)).join(", ")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEditDialog(group)}
                aria-label={`Edit ${group.name}`}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(group)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${group.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialogs();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? "Edit Group" : "Create New Group"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor={`${memberIdPrefix}-group-name`}>Group name</Label>
              <Input
                id={`${memberIdPrefix}-group-name`}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Couples, Friends"
              />
            </div>

            <div className="grid gap-2">
              <Label>Members (at least 2)</Label>
              <div className="grid max-h-56 gap-1 overflow-y-auto">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="flex min-h-[44px] items-center gap-3 rounded-md px-2 hover:bg-muted"
                  >
                    <Checkbox
                      id={`${memberIdPrefix}-${person.id}`}
                      checked={selectedMembers.has(person.id)}
                      onCheckedChange={() => toggleMember(person.id)}
                    />
                    <Label
                      htmlFor={`${memberIdPrefix}-${person.id}`}
                      className="flex-1 cursor-pointer self-stretch"
                    >
                      {person.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button
              onClick={editDialogOpen ? handleUpdate : handleCreate}
              disabled={!groupName.trim() || selectedMembers.size < 2}
            >
              {editDialogOpen ? "Update Group" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
