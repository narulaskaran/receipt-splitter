import { Edit, Calculator } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { type Receipt } from "@/types";
import { formatCurrency } from "@/lib/receipt-utils";

interface ReceiptDetailsProps {
  receipt: Receipt;
  onReceiptUpdate: (receipt: Receipt) => void;
}

export function ReceiptDetails({
  receipt,
  onReceiptUpdate,
}: ReceiptDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReceipt, setEditedReceipt] = useState<Receipt>(receipt);

  // Opens the edit dialog
  const openEditDialog = () => {
    setEditedReceipt({ ...receipt });
    setIsEditing(true);
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

    // Calculate missing fields if needed
    const updatedReceipt = { ...editedReceipt };

    // If tip is null, calculate it
    if (updatedReceipt.tip === null) {
      updatedReceipt.tip = Math.max(
        0,
        updatedReceipt.total - updatedReceipt.subtotal - updatedReceipt.tax
      );
    }

    onReceiptUpdate(updatedReceipt);
    setIsEditing(false);
    toast.success("Receipt details updated");
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Receipt Details
        </CardTitle>
        <Button variant="outline" size="sm" onClick={openEditDialog}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Restaurant</p>
            <p className="font-medium">{receipt.restaurant || "Unknown"}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">{receipt.date || "Unknown"}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Subtotal</p>
            <p className="font-medium">{formatCurrency(receipt.subtotal)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Tax</p>
            <p className="font-medium">{formatCurrency(receipt.tax)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Tip</p>
            <p className="font-medium">{formatCurrency(receipt.tip || 0)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="font-bold">{formatCurrency(receipt.total)}</p>
          </div>
        </div>
      </CardContent>

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
                    setEditedReceipt({
                      ...editedReceipt,
                      subtotal: parseFloat(e.target.value) || 0,
                    })
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
                    setEditedReceipt({
                      ...editedReceipt,
                      tax: parseFloat(e.target.value) || 0,
                    })
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
                        ? null
                        : parseFloat(e.target.value) || 0;

                    setEditedReceipt({
                      ...editedReceipt,
                      tip: value,
                    });
                  }}
                  placeholder="Calculate from total"
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
                  onChange={(e) =>
                    setEditedReceipt({
                      ...editedReceipt,
                      total: parseFloat(e.target.value) || 0,
                    })
                  }
                />
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
    </Card>
  );
}
