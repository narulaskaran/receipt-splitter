import { Pencil } from "lucide-react";
import { useState } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { type Receipt } from "@/types";
import { formatCurrency, validateReceiptInvariants, AmountValidationError } from "@/lib/receipt-utils";
import { getSupportedCurrencies } from "@/lib/currency";
import { ReceiptThumbnail } from "@/components/receipt-thumbnail";

function computedReceiptTotal(receipt: Pick<Receipt, "subtotal" | "tax" | "tip">): number {
  return new Decimal(receipt.subtotal || 0)
    .add(new Decimal(receipt.tax || 0))
    .add(new Decimal(receipt.tip || 0))
    .toNumber();
}

interface ReceiptDetailsProps {
  receipt: Receipt;
  onReceiptUpdate: (receipt: Receipt) => boolean | void;
  /** Persisted receipt image shown beside the parsed totals. */
  thumbnailUrl?: string;
  /** Accessible label for the thumbnail (e.g. restaurant name). */
  thumbnailAlt?: string;
}

export function ReceiptDetails({
  receipt,
  onReceiptUpdate,
  thumbnailUrl,
  thumbnailAlt = "Receipt preview",
}: ReceiptDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReceipt, setEditedReceipt] = useState<Receipt>(receipt);
  // Whether the user explicitly set a total during this edit session.
  // Until then, total auto-calculates from subtotal + tax + tip; once the
  // user types a total, it is respected so a genuine printed-total
  // mismatch can surface via the RECEIPT_TOTAL_MISMATCH guard on save.
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false);

  // Opens the edit dialog
  const openEditDialog = () => {
    setEditedReceipt({ ...receipt });
    setTotalManuallyEdited(false);
    setIsEditing(true);
  };

  // Updates an amount field; recalculates the total unless the user has
  // explicitly edited it
  const updateAmount = (
    field: "subtotal" | "tax" | "tip",
    value: number
  ) => {
    setEditedReceipt((prev) => {
      const next = { ...prev, [field]: value };
      if (!totalManuallyEdited) {
        next.total = computedReceiptTotal(next);
      }
      return next;
    });
  };

  const resetTotalToAutoCalculated = () => {
    setEditedReceipt((prev) => ({
      ...prev,
      total: computedReceiptTotal(prev),
    }));
    setTotalManuallyEdited(false);
  };

  // Handles the save operation
  const handleSave = () => {
    // Validate the numbers
    if (
      editedReceipt.subtotal < 0 ||
      editedReceipt.tax < 0 ||
      (editedReceipt.tip !== null && editedReceipt.tip < 0) ||
      editedReceipt.total < 0
    ) {
      toast.error("All amounts must be positive");
      return;
    }

    // Validate receipt invariants (including total balance)
    const validation = validateReceiptInvariants(editedReceipt, new Map(), []);

    // Check specifically for total mismatch errors
    const totalMismatchError = validation.errors.find(
      err => err.type === AmountValidationError.RECEIPT_TOTAL_MISMATCH
    );

    if (totalMismatchError) {
      toast.error(
        `Total ($${editedReceipt.total.toFixed(2)}) doesn't match ` +
        `subtotal + tax + tip ($${totalMismatchError.expected?.toFixed(2)})`
      );
      return;
    }

    const accepted = onReceiptUpdate(editedReceipt) !== false;
    if (!accepted) return;
    setIsEditing(false);
    toast.success("Receipt details updated");
  };

  const currencyInfo = getSupportedCurrencies().find(
    (c) => c.code === (receipt.currency || "USD")
  );
  const amounts = [
    { label: "Subtotal", value: receipt.subtotal },
    { label: "Tax", value: receipt.tax },
    { label: "Tip", value: receipt.tip || 0 },
    { label: "Total", value: receipt.total },
  ];

  return (
    <div className="flex gap-4">
      <ReceiptThumbnail
        variant="details"
        src={thumbnailUrl}
        alt={thumbnailAlt}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {amounts.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd
                className={`tabular-nums ${
                  label === "Total" ? "font-semibold" : "font-medium"
                }`}
              >
                {formatCurrency(value, receipt.currency)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {currencyInfo
              ? `${currencyInfo.code} - ${currencyInfo.name} (${currencyInfo.symbol})`
              : receipt.currency || "USD"}
          </p>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil />
            Edit details
          </Button>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Receipt Details</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="restaurant">Restaurant</Label>
                <Input
                  id="restaurant"
                  value={editedReceipt.restaurant || ""}
                  onChange={(e) =>
                    setEditedReceipt({
                      ...editedReceipt,
                      restaurant: e.target.value || null,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={
                    editedReceipt.date
                      ? editedReceipt.date.substring(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setEditedReceipt({
                      ...editedReceipt,
                      date: e.target.value || null,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={editedReceipt.currency || 'USD'}
                onValueChange={(value) =>
                  setEditedReceipt({
                    ...editedReceipt,
                    currency: value,
                  })
                }
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {getSupportedCurrencies().map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="subtotal">Subtotal</Label>
                <Input
                  id="subtotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedReceipt.subtotal}
                  onChange={(e) =>
                    updateAmount("subtotal", parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tax">Tax</Label>
                <Input
                  id="tax"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedReceipt.tax}
                  onChange={(e) =>
                    updateAmount("tax", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tip">Tip</Label>
                <Input
                  id="tip"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedReceipt.tip === null ? "" : editedReceipt.tip}
                  onChange={(e) => {
                    const value =
                      e.target.value.trim() === ""
                        ? 0
                        : parseFloat(e.target.value) || 0;

                    updateAmount("tip", value);
                  }}
                  placeholder="Leave empty for $0 tip"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="total">Total</Label>
                <Input
                  id="total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedReceipt.total}
                  onChange={(e) => {
                    setTotalManuallyEdited(true);
                    setEditedReceipt((prev) => ({
                      ...prev,
                      total: parseFloat(e.target.value) || 0,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from subtotal + tax + tip unless edited
                  {totalManuallyEdited && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2 hover:no-underline"
                        onClick={resetTotalToAutoCalculated}
                      >
                        Reset total to auto-calculated
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
