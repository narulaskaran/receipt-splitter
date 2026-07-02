import { useState, useEffect } from "react";
import { Check, AlertCircle, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import { EditSplitDialog } from "./edit-split-dialog";
import { EditItemDialog } from "./edit-item-dialog";
import { AddItemDialog } from "./add-item-dialog";

interface ItemAssignmentProps {
  receipt: Receipt;
  people: Person[];
  groups?: Group[];
  assignedItems: Map<number, PersonItemAssignment[]>;
  unassignedItems: number[];
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

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Assign Items</CardTitle>
        <Button variant="outline" size="sm" onClick={handleAddItem}>
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </CardHeader>

      <CardContent>
        {people.length === 0 ? (
          <p className="text-muted-foreground">
            Add people first to assign items
          </p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Assigned To</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.items.map((item, index) => (
                    <TableRow
                      key={index}
                      className={
                        unassignedItems.includes(index) ? "bg-destructive/5" : ""
                      }
                    >
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.quantity > 1 && (
                          <div className="text-sm text-muted-foreground">
                            Qty: {item.quantity}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[90px] justify-between"
                          onClick={() => handleEditItem(index)}
                          title="Click to edit price and quantity"
                        >
                          {formatCurrency(item.price * (item.quantity || 1))}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isItemFullyAssigned(index) ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-w-[120px] justify-between"
                              >
                                <span
                                  className={
                                    unassignedItems.includes(index)
                                      ? "text-destructive"
                                      : ""
                                  }
                                >
                                  {getAssignmentSummary(index)}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="end">
                              <div className="p-2 flex flex-col gap-2 max-h-64 overflow-y-auto">
                                {/* Individual People */}
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Individuals
                                </div>
                                {people.map((person) => (
                                  <div
                                    key={person.id}
                                    className="flex items-center gap-2"
                                  >
                                    <Checkbox
                                      id={`person-${person.id}-item-${index}`}
                                      checked={(
                                        selectedPeople.get(index) || new Set()
                                      ).has(person.id)}
                                      onCheckedChange={() =>
                                        togglePersonSelection(index, person.id)
                                      }
                                    />
                                    <label
                                      htmlFor={`person-${person.id}-item-${index}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                      {person.name}
                                    </label>
                                  </div>
                                ))}

                                {/* Groups */}
                                {groups && groups.length > 0 && (
                                  <>
                                    <div className="border-t pt-2 mt-2">
                                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                        Groups
                                      </div>
                                      {groups.map((group) => (
                                        <div
                                          key={group.id}
                                          className="flex items-center gap-2"
                                        >
                                          <Checkbox
                                            id={`group-${group.id}-item-${index}`}
                                            checked={isGroupFullySelected(
                                              index,
                                              group
                                            )}
                                            onCheckedChange={() =>
                                              toggleGroupSelection(index, group)
                                            }
                                            className={
                                              isGroupPartiallySelected(
                                                index,
                                                group
                                              ) &&
                                              !isGroupFullySelected(index, group)
                                                ? "data-[state=unchecked]:border-primary data-[state=unchecked]:bg-primary/20"
                                                : ""
                                            }
                                          />
                                          <label
                                            htmlFor={`group-${group.id}-item-${index}`}
                                            className="flex-1 cursor-pointer"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 flex items-center justify-center">
                                                {group.emoji || "👥"}
                                              </div>
                                              <div className="flex-1">
                                                <div className="text-sm font-medium">
                                                  {group.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {group.memberIds
                                                    .map(
                                                      (id) =>
                                                        people.find(
                                                          (p) => p.id === id
                                                        )?.name
                                                    )
                                                    .filter(Boolean)
                                                    .join(", ")}
                                                </div>
                                              </div>
                                            </div>
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentItemIndex(index);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteItem(index)}
                            title="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
              ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {receipt.items.map((item, index) => (
                <Card
                  key={index}
                  className={`${
                    unassignedItems.includes(index) ? "border-destructive/50 bg-destructive/5" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Item Name and Quantity */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.name}</div>
                          {item.quantity > 1 && (
                            <div className="text-xs text-muted-foreground">
                              Qty: {item.quantity}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2 text-xs px-2"
                          onClick={() => handleEditItem(index)}
                          title="Edit price and quantity"
                        >
                          {formatCurrency(item.price * (item.quantity || 1))}
                        </Button>
                      </div>

                      {/* Assignment Status and Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isItemFullyAssigned(index) ? (
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 justify-between text-xs px-2 min-w-0"
                              >
                                <span
                                  className={`truncate ${
                                    unassignedItems.includes(index)
                                      ? "text-destructive"
                                      : ""
                                  }`}
                                >
                                  {getAssignmentSummary(index)}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-80" align="end">
                              <div className="p-2 flex flex-col gap-2 max-h-64 overflow-y-auto">
                                {/* Individual People */}
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Individuals
                                </div>
                                {people.map((person) => (
                                  <div
                                    key={person.id}
                                    className="flex items-center gap-2"
                                  >
                                    <Checkbox
                                      id={`person-${person.id}-item-${index}-mobile`}
                                      checked={(
                                        selectedPeople.get(index) || new Set()
                                      ).has(person.id)}
                                      onCheckedChange={() =>
                                        togglePersonSelection(index, person.id)
                                      }
                                    />
                                    <label
                                      htmlFor={`person-${person.id}-item-${index}-mobile`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                      {person.name}
                                    </label>
                                  </div>
                                ))}

                                {/* Groups */}
                                {groups && groups.length > 0 && (
                                  <>
                                    <div className="border-t pt-2 mt-2">
                                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                        Groups
                                      </div>
                                      {groups.map((group) => (
                                        <div
                                          key={group.id}
                                          className="flex items-center gap-2"
                                        >
                                          <Checkbox
                                            id={`group-${group.id}-item-${index}-mobile`}
                                            checked={isGroupFullySelected(
                                              index,
                                              group
                                            )}
                                            onCheckedChange={() =>
                                              toggleGroupSelection(index, group)
                                            }
                                            className={
                                              isGroupPartiallySelected(
                                                index,
                                                group
                                              ) &&
                                              !isGroupFullySelected(index, group)
                                                ? "data-[state=unchecked]:border-primary data-[state=unchecked]:bg-primary/20"
                                                : ""
                                            }
                                          />
                                          <label
                                            htmlFor={`group-${group.id}-item-${index}-mobile`}
                                            className="flex-1 cursor-pointer"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 flex items-center justify-center">
                                                {group.emoji || "👥"}
                                              </div>
                                              <div className="flex-1">
                                                <div className="text-sm font-medium">
                                                  {group.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {group.memberIds
                                                    .map(
                                                      (id) =>
                                                        people.find(
                                                          (p) => p.id === id
                                                        )?.name
                                                    )
                                                    .filter(Boolean)
                                                    .join(", ")}
                                                </div>
                                              </div>
                                            </div>
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentItemIndex(index);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteItem(index)}
                            title="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <EditSplitDialog
          open={open}
          onOpenChange={setOpen}
          itemIndex={currentItemIndex ?? 0}
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
          onSave={(price, quantity) =>
            saveItemEdit(price, quantity)
          }
        />

        <AddItemDialog
          open={addItemDialogOpen}
          onOpenChange={setAddItemDialogOpen}
          onSave={(name, price, quantity) =>
            saveNewItem(name, price, quantity)
          }
        />
      </CardContent>
    </Card>
  );
}
