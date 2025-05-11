import { useState, useEffect } from "react";
import { Check, AlertCircle, Pencil, Edit } from "lucide-react";
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

import { type Receipt, type Person, type PersonItemAssignment } from "@/types";
import { formatCurrency } from "@/lib/receipt-utils";

interface ItemAssignmentProps {
  receipt: Receipt;
  people: Person[];
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

  // Open the assignment dialog for a specific item
  const openAssignmentDialog = (itemIndex: number) => {
    // Get current assignments for this item
    const currentAssignments = assignedItems.get(itemIndex) || [];

    // Build assignments map for the form
    const newAssignments = new Map<string, number>();

    // Initialize with existing assignments
    currentAssignments.forEach((assignment) => {
      newAssignments.set(assignment.personId, assignment.sharePercentage);
    });

    setAssignments(newAssignments);
    setCurrentItemIndex(itemIndex);
    setOpen(true);
  };

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
    const selectedPeopleIds = Array.from(assignments.keys());

    if (selectedPeopleIds.length === 0) {
      toast.error("Please select at least one person");
      return;
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

    if (
      itemAssignments.length === 1 &&
      itemAssignments[0].sharePercentage === 100
    ) {
      return getPersonName(itemAssignments[0].personId);
    }

    return itemAssignments
      .map(
        (a) => `${getPersonName(a.personId)} (${a.sharePercentage.toFixed(2)}%)`
      )
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
                          <div className="p-2 flex flex-col gap-2">
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
                  <Label htmlFor="item-price">Price</Label>
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
