import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Decimal from "decimal.js";

import { type Person, type PersonItemAssignment } from "@/types";
import { formatCurrency, distributeEqualShares } from "@/lib/receipt-utils";

type SplitMode = "percent" | "amount";

interface EditSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemIndex: number;
  itemName: string;
  itemPrice: number;
  itemQuantity: number;
  currency: string;
  people: Person[];
  existingAssignments: PersonItemAssignment[];
  onSave: (itemIndex: number, assignments: PersonItemAssignment[]) => void;
}

export function EditSplitDialog({
  open,
  onOpenChange,
  itemIndex,
  itemName,
  itemPrice,
  itemQuantity,
  currency,
  people,
  existingAssignments,
  onSave,
}: EditSplitDialogProps) {
  const [assignments, setAssignments] = useState<Map<string, number>>(
    new Map()
  );
  const [rawInputs, setRawInputs] = useState<Map<string, string>>(new Map());
  const [splitMode, setSplitMode] = useState<SplitMode>("percent");

  const itemTotal = new Decimal(itemPrice).times(itemQuantity || 1);

  // Initialize from existing assignments when dialog opens
  useEffect(() => {
    if (open) {
      setRawInputs(new Map());
      setSplitMode("percent");

      if (existingAssignments.length > 0) {
        const newAssignments = new Map<string, number>();
        existingAssignments.forEach((a) => {
          newAssignments.set(a.personId, a.sharePercentage);
        });
        setAssignments(newAssignments);
      } else {
        setAssignments(new Map());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemIndex]);

  const getDisplayValue = (personId: string): string => {
    if (rawInputs.has(personId)) {
      return rawInputs.get(personId) || "";
    }
    const pct = assignments.get(personId);
    if (pct === undefined) return "";

    if (splitMode === "percent") {
      return pct.toString();
    } else {
      const amount = itemTotal.mul(pct).div(100);
      return amount.toNumber().toFixed(2);
    }
  };

  const handleChange = (personId: string, value: string) => {
    const newRawInputs = new Map(rawInputs);
    const newAssignments = new Map(assignments);

    if (value === "") {
      newRawInputs.delete(personId);
      newAssignments.delete(personId);
    } else {
      newRawInputs.set(personId, value);
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        if (splitMode === "percent") {
          newAssignments.set(personId, numValue);
        } else {
          // Convert dollar amount to percentage
          if (itemTotal.isZero()) {
            newAssignments.set(personId, 0);
          } else {
            const pct = new Decimal(numValue).div(itemTotal).mul(100).toNumber();
            newAssignments.set(personId, pct);
          }
        }
      }
    }

    setRawInputs(newRawInputs);
    setAssignments(newAssignments);
  };

  const splitEqually = () => {
    let selectedPeopleIds = Array.from(assignments.keys());

    if (selectedPeopleIds.length === 0) {
      selectedPeopleIds = people.map((p) => p.id);
      if (selectedPeopleIds.length === 0) {
        toast.error("No people to assign");
        return;
      }
      const tmpAssignments = new Map(assignments);
      selectedPeopleIds.forEach((personId) => {
        tmpAssignments.set(personId, 0);
      });
      setAssignments(tmpAssignments);
    }

    const result = distributeEqualShares(selectedPeopleIds);
    const newAssignments = new Map<string, number>();
    result.forEach((a) => {
      newAssignments.set(a.personId, a.sharePercentage);
    });
    setAssignments(newAssignments);
    setRawInputs(new Map());
  };

  const saveAssignment = () => {
    let assignmentArray: PersonItemAssignment[];

    if (splitMode === "amount") {
      const dollarSum = Array.from(assignments.values()).reduce(
        (sum, pct) =>
          sum.plus(new Decimal(pct || 0).dividedBy(100).times(itemTotal)),
        new Decimal(0)
      );

      if (dollarSum.minus(itemTotal).abs().greaterThan(0.01)) {
        toast.error(
          `Dollar amounts must sum to ${formatCurrency(
            itemTotal.toNumber(),
            currency
          )}`
        );
        return;
      }

      const entries = Array.from(assignments.entries()).filter(
        ([, pct]) => pct > 0
      );

      assignmentArray = [];
      let runningPct = new Decimal(0);

      entries.forEach(([personId, pct], index) => {
        if (index === entries.length - 1) {
          const lastPct = new Decimal(100).minus(runningPct);
          assignmentArray.push({
            personId,
            sharePercentage: +lastPct.toFixed(2),
          });
        } else {
          const rounded = new Decimal(pct).toDecimalPlaces(2);
          assignmentArray.push({
            personId,
            sharePercentage: rounded.toNumber(),
          });
          runningPct = runningPct.plus(rounded);
        }
      });
    } else {
      const totalPercentage = Array.from(assignments.values()).reduce(
        (sum, value) => sum + (value || 0),
        0
      );

      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast.error("Total percentage must be 100%");
        return;
      }

      assignmentArray = [];
      assignments.forEach((percentage, personId) => {
        if (percentage > 0) {
          assignmentArray.push({
            personId,
            sharePercentage: percentage,
          });
        }
      });
    }

    onSave(itemIndex, assignmentArray);
    onOpenChange(false);
  };

  const totalPct = Array.from(assignments.values()).reduce(
    (sum, v) => sum + (v || 0),
    0
  );
  const dollarSum = Array.from(assignments.values()).reduce(
    (sum, pct) =>
      sum.plus(new Decimal(pct || 0).dividedBy(100).times(itemTotal)),
    new Decimal(0)
  );
  const isValid =
    splitMode === "amount"
      ? dollarSum.minus(itemTotal).abs().lessThanOrEqualTo(0.01)
      : Math.abs(totalPct - 100) <= 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit Split: {itemName}
            {itemQuantity > 1 ? ` (x${itemQuantity})` : ""}
          </DialogTitle>
        </DialogHeader>
        {(() => {
          return (
            <>
              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Item Total:</span>
                  <span>
                    {formatCurrency(itemTotal.toNumber(), currency)}
                  </span>
                </div>
                <div className="flex rounded-md border overflow-hidden">
                  <Button
                    type="button"
                    variant={splitMode === "percent" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-7 px-2 text-xs"
                    onClick={() => {
                      setSplitMode("percent");
                      setRawInputs(new Map());
                    }}
                  >
                    %
                  </Button>
                  <Button
                    type="button"
                    variant={splitMode === "amount" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-7 px-2 text-xs"
                    onClick={() => {
                      setSplitMode("amount");
                      setRawInputs(new Map());
                    }}
                  >
                    $
                  </Button>
                </div>
              </div>

              {people.map((person) => (
                <div
                  key={person.id}
                  className="grid grid-cols-2 items-center gap-4"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`person-${person.id}-dialog`}
                      checked={assignments.has(person.id)}
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
                      id={`person-${person.id}-${splitMode}`}
                      type="text"
                      inputMode="decimal"
                      value={getDisplayValue(person.id)}
                      onChange={(e) =>
                        handleChange(person.id, e.target.value)
                      }
                      onBlur={() => {
                        const newRawInputs = new Map(rawInputs);
                        newRawInputs.delete(person.id);
                        setRawInputs(newRawInputs);
                      }}
                      className="w-20 text-right"
                    />
                    <span className="ml-2">
                      {splitMode === "percent" ? "%" : ""}
                    </span>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <span className="font-medium">Total:</span>
                <span
                  className={
                    isValid
                      ? "text-green-500 font-medium"
                      : "text-destructive font-medium"
                  }
                >
                  {splitMode === "amount"
                    ? `${formatCurrency(
                        dollarSum.toNumber(),
                        currency
                      )} / ${formatCurrency(itemTotal.toNumber(), currency)}`
                    : `${totalPct}%`}
                </span>
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
                  disabled={!isValid}
                >
                  Save Assignment
                </Button>
              </DialogFooter>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
