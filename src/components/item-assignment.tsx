import { useState, useEffect } from "react";
import { Check, AlertCircle, Pencil } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency } from "@/lib/receipt-utils";

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
  onReceiptUpdate: (receipt: Receipt) => void;
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
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [currentEditItemIndex, setCurrentEditItemIndex] = useState<
    number | null
  >(null);
  const [editedItem, setEditedItem] = useState<{
    price: number;
    quantity: number;
  } | null>(null);
  const [assignments, setAssignments] = useState<Map<string, number>>(
    new Map()
  );
  const [selectedPeople, setSelectedPeople] = useState<
    Map<number, Set<string>>
  >(new Map());

  // Apply selections to assignments when the dialog opens
  useEffect(() => {
    if (currentItemIndex !== null && open) {
      const selected = selectedPeople.get(currentItemIndex) || new Set();

      if (selected.size > 0) {
        // If we have selected people but no assignments yet, initialize with equal split
        const peopleToAssign = Array.from(selected);
        const equalShare = +(100 / peopleToAssign.length).toFixed(2);

        const newAssignments = new Map<string, number>();
        let runningSum = 0;

        peopleToAssign.forEach((personId, index) => {
          // Last person gets the remainder to ensure total is exactly 100%
          if (index === peopleToAssign.length - 1) {
            const lastShare = +(100 - runningSum).toFixed(2);
            newAssignments.set(personId, lastShare);
          } else {
            newAssignments.set(personId, equalShare);
            runningSum += equalShare;
          }
        });

        setAssignments(newAssignments);
      }
    }
  }, [currentItemIndex, open, selectedPeople]);

  // Handle split equally between selected people
  const splitEqually = () => {
    if (currentItemIndex === null) return;

    // Get selected people (those with any value assigned)
    let selectedPeopleIds = Array.from(assignments.keys());

    // If none are selected, select all people
    if (selectedPeopleIds.length === 0) {
      selectedPeopleIds = people.map((p) => p.id);
      if (selectedPeopleIds.length === 0) {
        toast.error("No people to assign");
        return;
      }
      // Update assignments state to include all people with 0% (will be set below)
      const newAssignments = new Map(assignments);
      selectedPeopleIds.forEach((personId) => {
        newAssignments.set(personId, 0);
      });
      setAssignments(newAssignments);
    }

    // Calculate equal share with 2 decimal places
    const equalShare = +(100 / selectedPeopleIds.length).toFixed(2);

    // Distribute shares equally
    const newAssignments = new Map<string, number>();
    let runningSum = 0;

    // Assign equal shares
    selectedPeopleIds.forEach((personId, index) => {
      // Last person gets the remainder to ensure total is exactly 100%
      if (index === selectedPeopleIds.length - 1) {
        const lastShare = +(100 - runningSum).toFixed(2);
        newAssignments.set(personId, lastShare);
      } else {
        newAssignments.set(personId, equalShare);
        runningSum += equalShare;
      }
    });

    setAssignments(newAssignments);
  };

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
      const equalShare = +(100 / peopleToAssign.length).toFixed(2);

      const assignments: PersonItemAssignment[] = [];
      let runningSum = 0;

      peopleToAssign.forEach((personId, index) => {
        // Last person gets the remainder to ensure total is exactly 100%
        if (index === peopleToAssign.length - 1) {
          const lastShare = +(100 - runningSum).toFixed(2);
          assignments.push({
            personId,
            sharePercentage: lastShare,
          });
        } else {
          assignments.push({
            personId,
            sharePercentage: equalShare,
          });
          runningSum += equalShare;
        }
      });

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
      const equalShare = +(100 / peopleToAssign.length).toFixed(2);

      const assignments: PersonItemAssignment[] = [];
      let runningSum = 0;

      peopleToAssign.forEach((personId, index) => {
        // Last person gets the remainder to ensure total is exactly 100%
        if (index === peopleToAssign.length - 1) {
          const lastShare = +(100 - runningSum).toFixed(2);
          assignments.push({
            personId,
            sharePercentage: lastShare,
          });
        } else {
          assignments.push({
            personId,
            sharePercentage: equalShare,
          });
          runningSum += equalShare;
        }
      });

      // Call the parent handler to update assignments
      onAssignItems(itemIndex, assignments);
    } else {
      // If no people selected, clear assignments
      onAssignItems(itemIndex, []);
    }
  };

  // Save the assignment
  const saveAssignment = () => {
    if (currentItemIndex === null) return;

    // Calculate total percentage
    const totalPercentage = Array.from(assignments.values()).reduce(
      (sum, value) => sum + (value || 0),
      0
    );

    // Ensure total is 100%
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error("Total percentage must be 100%");
      return;
    }

    // Convert to assignment array
    const assignmentArray: PersonItemAssignment[] = [];

    assignments.forEach((percentage, personId) => {
      if (percentage > 0) {
        assignmentArray.push({
          personId,
          sharePercentage: percentage,
        });
      }
    });

    // Update selected people to match assignments
    const newSelected = new Set(assignmentArray.map((a) => a.personId));
    const newSelectedPeople = new Map(selectedPeople);
    newSelectedPeople.set(currentItemIndex, newSelected);
    setSelectedPeople(newSelectedPeople);

    // Call the parent handler
    onAssignItems(currentItemIndex, assignmentArray);

    // Close dialog
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
    const item = receipt.items[index];
    setCurrentEditItemIndex(index);
    setEditedItem({
      price: item.price,
      quantity: item.quantity || 1,
    });
    setEditItemDialogOpen(true);
  };

  // Save item edit
  const saveItemEdit = () => {
    if (currentEditItemIndex === null || !editedItem) return;

    const updatedReceipt = { ...receipt };
    updatedReceipt.items = [...receipt.items];
    updatedReceipt.items[currentEditItemIndex] = {
      ...updatedReceipt.items[currentEditItemIndex],
      price: editedItem.price,
      quantity: editedItem.quantity,
    };

    // Recalculate subtotal
    updatedReceipt.subtotal = updatedReceipt.items.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0
    );

    // Update the receipt
    onReceiptUpdate(updatedReceipt);
    setEditItemDialogOpen(false);
    setCurrentEditItemIndex(null);
    setEditedItem(null);
    toast.success("Item updated successfully");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Assign Items</CardTitle>
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
                          className="ml-2 text-xs px-2 py-1 h-7"
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
                                className="flex-1 justify-between text-xs px-2 py-1 h-7 min-w-0"
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => {
                            setCurrentItemIndex(index);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Split:{" "}
                {currentItemIndex !== null
                  ? receipt.items[currentItemIndex]?.name
                  : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Item Price:</span>
                <span>
                  {currentItemIndex !== null
                    ? formatCurrency(
                        receipt.items[currentItemIndex]?.price *
                          (receipt.items[currentItemIndex]?.quantity || 1)
                      )
                    : ""}
                </span>
              </div>

              {people.map((person) => (
                <div
                  key={person.id}
                  className="grid grid-cols-2 items-center gap-4"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`person-${person.id}-dialog`}
                      checked={!!assignments.get(person.id)}
                      onCheckedChange={(checked) => {
                        const newAssignments = new Map(assignments);
                        if (checked) {
                          newAssignments.set(person.id, 0);
                        } else {
                          newAssignments.delete(person.id);
                        }
                        setAssignments(newAssignments);
                      }}
                    />
                    <Label htmlFor={`person-${person.id}-dialog`}>
                      {person.name}
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <Input
                      id={`person-${person.id}-percent`}
                      type="number"
                      min="0"
                      max="100"
                      value={assignments.get(person.id) || ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        const newAssignments = new Map(assignments);
                        newAssignments.set(person.id, value);
                        setAssignments(newAssignments);
                      }}
                      className="w-20 text-right"
                      disabled={!assignments.has(person.id)}
                    />
                    <span className="ml-2">%</span>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <span className="font-medium">Total:</span>
                <span
                  className={
                    Math.abs(
                      Array.from(assignments.values()).reduce(
                        (sum, val) => sum + (val || 0),
                        0
                      ) - 100
                    ) > 0.01
                      ? "text-destructive font-medium"
                      : "text-green-500 font-medium"
                  }
                >
                  {Array.from(assignments.values()).reduce(
                    (sum, val) => sum + (val || 0),
                    0
                  )}
                  %
                </span>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={splitEqually}
                className="w-full sm:w-auto"
              >
                Split Equally
              </Button>
              <Button
                type="button"
                onClick={saveAssignment}
                className="w-full sm:w-auto"
                disabled={
                  Math.abs(
                    Array.from(assignments.values()).reduce(
                      (sum, val) => sum + (val || 0),
                      0
                    ) - 100
                  ) > 0.01
                }
              >
                Save Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New item edit dialog */}
        <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Item:{" "}
                {currentEditItemIndex !== null
                  ? receipt.items[currentEditItemIndex]?.name
                  : ""}
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveItemEdit();
              }}
            >
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="item-price">Item Price</Label>
                  <Input
                    id="item-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editedItem?.price || ""}
                    onChange={(e) =>
                      setEditedItem({
                        ...editedItem!,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="item-quantity">Quantity</Label>
                  <Input
                    id="item-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={editedItem?.quantity || ""}
                    onChange={(e) =>
                      setEditedItem({
                        ...editedItem!,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Total:</span>
                  <span>
                    {editedItem
                      ? formatCurrency(editedItem.price * editedItem.quantity)
                      : ""}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditItemDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
