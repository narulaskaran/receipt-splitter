import { useState } from "react";
import { PlusCircle, X, Users, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Users className="h-5 w-5" />
          Groups
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 mb-4">
          {!groups || groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create groups to quickly assign items to multiple people
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{group.emoji || "👥"}</span>
                    <span className="font-medium">{group.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Members:{" "}
                    {group.memberIds.map((id) => getPersonName(id)).join(", ")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onGroupEmojiRegenerate(group.id)}
                    title="Change emoji"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span className="sr-only">
                      Change emoji for {group.name}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(group)}
                  >
                    <Pencil className="h-3 w-3" />
                    <span className="sr-only">Edit {group.name}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(group)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Delete {group.name}</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={openCreateDialog}
          className="w-full"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Group
        </Button>

        {/* Create Group Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Couples, Friends"
                />
              </div>

              <div className="grid gap-2">
                <Label>Select Members</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`create-${person.id}`}
                        checked={selectedMembers.has(person.id)}
                        onCheckedChange={() => toggleMember(person.id)}
                      />
                      <Label
                        htmlFor={`create-${person.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
                onClick={handleCreate}
                disabled={!groupName.trim() || selectedMembers.size < 2}
              >
                Create Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Group Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Group</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-group-name">Group Name</Label>
                <Input
                  id="edit-group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Couples, Friends"
                />
              </div>

              <div className="grid gap-2">
                <Label>Select Members</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`edit-${person.id}`}
                        checked={selectedMembers.has(person.id)}
                        onCheckedChange={() => toggleMember(person.id)}
                      />
                      <Label
                        htmlFor={`edit-${person.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
                onClick={handleUpdate}
                disabled={!groupName.trim() || selectedMembers.size < 2}
              >
                Update Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
