import { useMemo, useState } from "react";
import { Check, AlertCircle, Pencil, Trash2, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  // People selected for each item, derived from the current assignments
  const selectedPeople = useMemo(() => {
    const map = new Map<number, Set<string>>();
    assignedItems.forEach((assignments, itemIndex) => {
      if (assignments.length > 0) {
        map.set(itemIndex, new Set(assignments.map((a) => a.personId)));
      }
    });
    return map;
  }, [assignedItems]);

  const personNames = useMemo(
    () => new Map(people.map((p) => [p.id, p.name])),
    [people]
  );
  const unassignedSet = new Set(unassignedItems);

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

  // Assign equal shares to the given selection immediately
  const assignSelection = (itemIndex: number, selected: Set<string>) => {
    onAssignItems(itemIndex, distributeEqualShares(Array.from(selected)));
  };

  // Toggle group selection for an item
  const toggleGroupSelection = (itemIndex: number, group: Group) => {
    const newSelected = new Set(selectedPeople.get(itemIndex));
    // If group is fully selected, deselect all members; otherwise select all
    const deselect = isGroupFullySelected(itemIndex, group);
    group.memberIds.forEach((memberId) => {
      if (deselect) newSelected.delete(memberId);
      else newSelected.add(memberId);
    });
    assignSelection(itemIndex, newSelected);
  };

  // Toggle person selection for an item
  const togglePersonSelection = (itemIndex: number, personId: string) => {
    const newSelected = new Set(selectedPeople.get(itemIndex));
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    assignSelection(itemIndex, newSelected);
  };

  // Handle split save from dialog
  const handleSaveSplit = (itemIndex: number, assignments: PersonItemAssignment[]) => {
    onAssignItems(itemIndex, assignments);
    setOpen(false);
    setCurrentItemIndex(null);
  };

  // Create a readable assignment summary
  const getAssignmentSummary = (itemIndex: number): string => {
    const itemAssignments = assignedItems.get(itemIndex) || [];

    if (itemAssignments.length === 0) {
      return "Unassigned";
    }

    // Show just the names of people assigned to this item
    return itemAssignments
      .map((a) => personNames.get(a.personId) || "Unknown")
      .join(", ");
  };

  // Checkbox list of people and groups for an item's assignment popover.
  // `idSuffix` keeps checkbox ids unique between the desktop and mobile layouts.
  const renderAssignmentOptions = (index: number, idSuffix = "") => (
    <div className="p-2 flex flex-col gap-2 max-h-64 overflow-y-auto">
      {/* Individual People */}
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Individuals
      </div>
      {people.map((person) => (
        <div key={person.id} className="flex items-center gap-2">
          <Checkbox
            id={`person-${person.id}-item-${index}${idSuffix}`}
            checked={selectedPeople.get(index)?.has(person.id) ?? false}
            onCheckedChange={() => togglePersonSelection(index, person.id)}
          />
          <label
            htmlFor={`person-${person.id}-item-${index}${idSuffix}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {person.name}
          </label>
        </div>
      ))}

      {/* Groups */}
      {groups.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Groups
          </div>
          {groups.map((group) => {
            const fullySelected = isGroupFullySelected(index, group);
            return (
              <div key={group.id} className="flex items-center gap-2">
                <Checkbox
                  id={`group-${group.id}-item-${index}${idSuffix}`}
                  checked={fullySelected}
                  onCheckedChange={() => toggleGroupSelection(index, group)}
                  className={
                    !fullySelected && isGroupPartiallySelected(index, group)
                      ? "data-[state=unchecked]:border-primary data-[state=unchecked]:bg-primary/20"
                      : ""
                  }
                />
                <label
                  htmlFor={`group-${group.id}-item-${index}${idSuffix}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {group.emoji || "👥"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{group.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {group.memberIds
                          .map((id) => personNames.get(id))
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

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
                        unassignedSet.has(index) ? "bg-destructive/5" : ""
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
                          {formatCurrency(item.price * (item.quantity || 1), receipt.currency)}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!unassignedSet.has(index) ? (
                            <Check className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
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
                                    unassignedSet.has(index)
                                      ? "text-muted-foreground"
                                      : ""
                                  }
                                >
                                  {getAssignmentSummary(index)}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="end">
                              {renderAssignmentOptions(index)}
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
                            aria-label={`Delete ${item.name}`}
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
            <div className="md:hidden -mx-6 divide-y border-y">
              {receipt.items.map((item, index) => (
                <div key={index} className="px-6 py-3">
                  <div className="space-y-2">
                    {/* Item Name and Quantity */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        {item.quantity > 1 && (
                          <div className="text-xs text-muted-foreground">
                            Qty: {item.quantity}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mr-2 ml-2 px-2 text-sm tabular-nums"
                        onClick={() => handleEditItem(index)}
                        title="Edit price and quantity"
                      >
                        {formatCurrency(item.price * (item.quantity || 1), receipt.currency)}
                      </Button>
                    </div>

                    {/* Assignment Status and Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {!unassignedSet.has(index) ? (
                          <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
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
                                  unassignedSet.has(index)
                                    ? "text-muted-foreground"
                                    : ""
                                }`}
                              >
                                {getAssignmentSummary(index)}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-80" align="end">
                            {renderAssignmentOptions(index, "-mobile")}
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
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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
