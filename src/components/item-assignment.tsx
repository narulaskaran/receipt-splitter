import { useState, useEffect } from "react";
import { Check, AlertCircle, ChevronDown, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import {
  type Receipt,
  type Person,
  type PersonItemAssignment,
  type Group,
} from "@/types";
import {
  formatCurrency,
  calculateSubtotal,
  remapAssignmentsAfterDelete,
  distributeEqualShares,
} from "@/lib/receipt-utils";
import { UNTITLED_RECEIPT_NAME } from "@/lib/receipt-labels";
import { EditSplitDialog } from "./edit-split-dialog";
import { EditItemDialog } from "./edit-item-dialog";
import { AddItemDialog } from "./add-item-dialog";

interface ItemAssignmentProps {
  receipt: Receipt;
  people: Person[];
  groups?: Group[];
  assignedItems: Map<number, PersonItemAssignment[]>;
  unassignedItems: number[];
  title?: string;
  subtitle?: string;
  onSplitEvenly?: () => void;
  onAssignItems: (
    itemIndex: number,
    assignments: PersonItemAssignment[]
  ) => void;
  onReceiptUpdate: (
    receipt: Receipt,
    remappedAssignments?: Map<number, PersonItemAssignment[]>
  ) => void;
}

export function ItemAssignment({
  receipt,
  people,
  groups = [],
  assignedItems,
  unassignedItems,
  title = receipt.restaurant || UNTITLED_RECEIPT_NAME,
  subtitle,
  onSplitEvenly,
  onAssignItems,
  onReceiptUpdate,
}: ItemAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [currentEditItemIndex, setCurrentEditItemIndex] = useState<
    number | null
  >(null);
  const [selectedPeople, setSelectedPeople] = useState<
    Map<number, Set<string>>
  >(new Map());

  // Check if all members of a group are selected for an item
  const isGroupFullySelected = (itemIndex: number, group: Group): boolean => {
    const selected = selectedPeople.get(itemIndex) || new Set<string>();
    return group.memberIds.every((memberId) => selected.has(memberId));
  };

  // Check if any members of a group are selected for an item
  const isGroupPartiallySelected = (
    itemIndex: number,
    group: Group
  ): boolean => {
    const selected = selectedPeople.get(itemIndex) || new Set<string>();
    return group.memberIds.some((memberId) => selected.has(memberId));
  };

  // Toggle group selection for an item
  const toggleGroupSelection = (itemIndex: number, group: Group) => {
    const currentSelected = selectedPeople.get(itemIndex) || new Set<string>();
    const newSelected = new Set(currentSelected);

    // If group is fully selected, deselect all members
    if (isGroupFullySelected(itemIndex, group)) {
      group.memberIds.forEach((memberId) => {
        newSelected.delete(memberId);
      });
    } else {
      // If group is not fully selected, select all members
      group.memberIds.forEach((memberId) => {
        newSelected.add(memberId);
      });
    }

    // Update selected people
    const newSelectedPeople = new Map(selectedPeople);
    newSelectedPeople.set(itemIndex, newSelected);
    setSelectedPeople(newSelectedPeople);

    // Auto-assign equal shares immediately
    if (newSelected.size > 0) {
      const peopleToAssign = Array.from(newSelected);
      const assignments = distributeEqualShares(peopleToAssign);

      // Call the parent handler to update assignments
      onAssignItems(itemIndex, assignments);
    } else {
      // If no people selected, clear assignments
      onAssignItems(itemIndex, []);
    }
  };

  // Toggle person selection for an item
  const togglePersonSelection = (itemIndex: number, personId: string) => {
    // Get current selected people for this item
    const currentSelected = selectedPeople.get(itemIndex) || new Set<string>();
    const newSelected = new Set(currentSelected);

    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }

    // Update selected people
    const newSelectedPeople = new Map(selectedPeople);
    newSelectedPeople.set(itemIndex, newSelected);
    setSelectedPeople(newSelectedPeople);

    // Auto-assign equal shares immediately
    if (newSelected.size > 0) {
      const peopleToAssign = Array.from(newSelected);
      const assignments = distributeEqualShares(peopleToAssign);

      // Call the parent handler to update assignments
      onAssignItems(itemIndex, assignments);
    } else {
      // If no people selected, clear assignments
      onAssignItems(itemIndex, []);
    }
  };

  // Handle split save from dialog
  const handleSaveSplit = (itemIndex: number, assignments: PersonItemAssignment[]) => {
    const newSelected = new Set(assignments.map((a) => a.personId));
    const newSelectedPeople = new Map(selectedPeople);
    newSelectedPeople.set(itemIndex, newSelected);
    setSelectedPeople(newSelectedPeople);
    onAssignItems(itemIndex, assignments);
    setOpen(false);
    setCurrentItemIndex(null);
  };

  // Get person name by ID
  const getPersonName = (personId: string): string => {
    return people.find((p) => p.id === personId)?.name || "Unknown";
  };

  // Create a readable assignment summary
  const getAssignmentSummary = (itemIndex: number): string => {
    const itemAssignments = assignedItems.get(itemIndex) || [];

    if (itemAssignments.length === 0) {
      return "Unassigned";
    }

    // Show just the names of people assigned to this item
    return itemAssignments
      .map((a) => getPersonName(a.personId))
      .join(", ");
  };

  // Check if an item is fully assigned (100%)
  const isItemFullyAssigned = (itemIndex: number): boolean => {
    const itemAssignments = assignedItems.get(itemIndex) || [];
    const totalPercentage = itemAssignments.reduce(
      (sum, a) => sum + a.sharePercentage,
      0
    );
    return Math.abs(totalPercentage - 100) < 0.01;
  };

  // Initialize selected people from existing assignments
  useEffect(() => {
    const newSelectedPeople = new Map<number, Set<string>>();

    assignedItems.forEach((assignments, itemIndex) => {
      const selected = new Set(assignments.map((a) => a.personId));
      if (selected.size > 0) {
        newSelectedPeople.set(itemIndex, selected);
      }
    });

    setSelectedPeople(newSelectedPeople);
  }, [assignedItems]);

  // Handle item edit
  const handleEditItem = (index: number) => {
    setCurrentEditItemIndex(index);
    setEditItemDialogOpen(true);
  };

  // Save item edit
  const saveItemEdit = (price: number, quantity: number) => {
    if (currentEditItemIndex === null) return;

    const updatedReceipt = { ...receipt };
    updatedReceipt.items = [...receipt.items];
    updatedReceipt.items[currentEditItemIndex] = {
      ...updatedReceipt.items[currentEditItemIndex],
      price,
      quantity,
    };

    // Recalculate subtotal using Decimal.js
    updatedReceipt.subtotal = calculateSubtotal(updatedReceipt.items);

    // Update the receipt
    onReceiptUpdate(updatedReceipt);
    setEditItemDialogOpen(false);
    setCurrentEditItemIndex(null);
    toast.success("Item updated successfully");
  };

  // Handle item deletion
  const handleDeleteItem = (index: number) => {
    const item = receipt.items[index];
    const updatedReceipt = { ...receipt };
    updatedReceipt.items = receipt.items.filter((_, i) => i !== index);

    // Recalculate subtotal using Decimal.js
    updatedReceipt.subtotal = calculateSubtotal(updatedReceipt.items);

    // Remap assignments - shift indices after deletion
    const remappedAssignments = remapAssignmentsAfterDelete(assignedItems, index);

    // Pass both updated receipt AND remapped assignments to parent
    onReceiptUpdate(updatedReceipt, remappedAssignments);
    toast.success(`Deleted "${item.name}"`);
  };

  // Handle adding a new item
  const handleAddItem = () => {
    setAddItemDialogOpen(true);
  };

  // Save new item
  const saveNewItem = (name: string, price: number, quantity: number) => {
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }

    if (price < 0) {
      toast.error("Price must be positive");
      return;
    }

    if (quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const updatedReceipt = { ...receipt };
    updatedReceipt.items = [
      ...receipt.items,
      {
        name: name.trim(),
        price,
        quantity,
      },
    ];

    // Recalculate subtotal using Decimal.js
    updatedReceipt.subtotal = calculateSubtotal(updatedReceipt.items);

    // Update the receipt
    onReceiptUpdate(updatedReceipt);
    setAddItemDialogOpen(false);
    toast.success(`Added "${name.trim()}"`);
  };

  // People + groups checklist shown in each item's popover
  const renderPicker = (index: number) => (
    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto p-2">
      <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Individuals
      </div>
      {people.map((person) => (
        <div key={person.id} className="flex items-center gap-2">
          <Checkbox
            id={`person-${person.id}-item-${index}`}
            checked={(selectedPeople.get(index) || new Set()).has(person.id)}
            onCheckedChange={() => togglePersonSelection(index, person.id)}
          />
          <label
            htmlFor={`person-${person.id}-item-${index}`}
            className="cursor-pointer text-sm leading-none font-medium"
          >
            {person.name}
          </label>
        </div>
      ))}

      {groups.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Groups
          </div>
          {groups.map((group) => (
            <div key={group.id} className="flex items-center gap-2">
              <Checkbox
                id={`group-${group.id}-item-${index}`}
                checked={isGroupFullySelected(index, group)}
                onCheckedChange={() => toggleGroupSelection(index, group)}
                className={
                  isGroupPartiallySelected(index, group) &&
                  !isGroupFullySelected(index, group)
                    ? "data-[state=unchecked]:border-primary data-[state=unchecked]:bg-primary/20"
                    : ""
                }
              />
              <label
                htmlFor={`group-${group.id}-item-${index}`}
                className="flex flex-1 cursor-pointer items-center gap-2"
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {group.emoji || "👥"}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{group.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {group.memberIds
                      .map((id) => people.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          {onSplitEvenly ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSplitEvenly}
              disabled={people.length === 0 || unassignedItems.length === 0}
            >
              Split evenly
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {people.length === 0 ? (
          <p className="text-muted-foreground">
            Add people first to assign items
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {receipt.items.map((item, index) => {
              const isUnassigned = unassignedItems.includes(index);
              return (
                <li
                  key={index}
                  className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 ${
                    isUnassigned ? "bg-destructive/5" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isItemFullyAssigned(index) ? (
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.name}</div>
                      {item.quantity > 1 && (
                        <div className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 tabular-nums"
                      onClick={() => handleEditItem(index)}
                      title="Click to edit price and quantity"
                    >
                      {formatCurrency(
                        item.price * (item.quantity || 1),
                        receipt.currency
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 sm:w-auto">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-0 flex-1 justify-between sm:w-48 sm:flex-none"
                        >
                          <span
                            className={`truncate ${
                              isUnassigned ? "text-destructive" : ""
                            }`}
                          >
                            {getAssignmentSummary(index)}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="end">
                        {renderPicker(index)}
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setCurrentItemIndex(index);
                        setOpen(true);
                      }}
                      title="Custom split"
                      aria-label={`Custom split for ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteItem(index)}
                      title="Delete item"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <EditSplitDialog
          open={open}
          onOpenChange={setOpen}
          itemIndex={currentItemIndex}
          itemName={
            currentItemIndex !== null
              ? receipt.items[currentItemIndex]?.name
              : ""
          }
          itemPrice={
            currentItemIndex !== null
              ? receipt.items[currentItemIndex]?.price ?? 0
              : 0
          }
          itemQuantity={
            currentItemIndex !== null
              ? receipt.items[currentItemIndex]?.quantity ?? 1
              : 1
          }
          currency={receipt.currency}
          people={people}
          existingAssignments={
            currentItemIndex !== null
              ? assignedItems.get(currentItemIndex) || []
              : []
          }
          selectedPersonIds={
            currentItemIndex !== null
              ? Array.from(selectedPeople.get(currentItemIndex) || [])
              : []
          }
          onSave={handleSaveSplit}
        />

        <EditItemDialog
          open={editItemDialogOpen}
          onOpenChange={setEditItemDialogOpen}
          itemName={
            currentEditItemIndex !== null
              ? receipt.items[currentEditItemIndex]?.name
              : ""
          }
          initialPrice={
            currentEditItemIndex !== null
              ? receipt.items[currentEditItemIndex]?.price ?? 0
              : 0
          }
          initialQuantity={
            currentEditItemIndex !== null
              ? receipt.items[currentEditItemIndex]?.quantity ?? 1
              : 1
          }
          currency={receipt.currency}
          onSave={saveItemEdit}
        />

        <AddItemDialog
          open={addItemDialogOpen}
          onOpenChange={setAddItemDialogOpen}
          currency={receipt.currency}
          onSave={saveNewItem}
        />
      </CardContent>
    </Card>
  );
}
