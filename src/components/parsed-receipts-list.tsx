import { useEffect, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptDetails } from "@/components/receipt-details";
import { formatCurrency } from "@/lib/receipt-utils";
import { MAX_RECEIPTS_PER_SESSION } from "@/lib/constants";
import { type Receipt, type StoredReceipt } from "@/types";

interface ParsedReceiptsListProps {
  receipts: StoredReceipt[];
  onReceiptUpdate: (receiptId: string, receipt: Receipt) => void;
  onRemoveReceipt: (receiptId: string) => void;
}

function untitledName(receipt: StoredReceipt): string {
  const name = receipt.receipt.restaurant?.trim();
  return name ? name : "Untitled receipt";
}

/** Distinguish same-restaurant receipts with date, then a short index. */
export function receiptDisplayName(
  stored: StoredReceipt,
  receipts: StoredReceipt[]
): string {
  const name = untitledName(stored);
  const sameName = receipts.filter((r) => untitledName(r) === name);
  if (sameName.length <= 1) return name;

  const sameDate = sameName.filter(
    (r) => r.receipt.date === stored.receipt.date
  );
  if (stored.receipt.date && sameDate.length === 1) {
    return `${name} · ${stored.receipt.date}`;
  }

  const index = sameName.findIndex((r) => r.id === stored.id) + 1;
  return `${name} (${index})`;
}

export function ParsedReceiptsList({
  receipts,
  onReceiptUpdate,
  onRemoveReceipt,
}: ParsedReceiptsListProps) {
  const lastId = receipts[receipts.length - 1]?.id ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(lastId);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (lastId) {
      setExpandedId(lastId);
    } else {
      setExpandedId(null);
    }
  }, [lastId]);

  if (receipts.length === 0) return null;

  const pendingRemove = receipts.find((r) => r.id === pendingRemoveId);
  const visibleExpandedId =
    expandedId && receipts.some((r) => r.id === expandedId)
      ? expandedId
      : lastId;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">
          Receipts ({receipts.length}/{MAX_RECEIPTS_PER_SESSION})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {receipts.map((stored) => {
          const { receipt } = stored;
          const itemCount = receipt.items.length;
          const isExpanded = stored.id === visibleExpandedId;
          const label = receiptDisplayName(stored, receipts);
          const metaParts = [
            receipt.date || null,
            `${itemCount} ${itemCount === 1 ? "item" : "items"}`,
            formatCurrency(receipt.total, receipt.currency),
            receipt.currency,
          ].filter(Boolean);

          return (
            <div
              key={stored.id}
              className="rounded-lg border"
            >
              <div className="flex items-start gap-2 p-3">
                <button
                  type="button"
                  className="flex flex-1 items-start gap-2 text-left min-w-0"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : stored.id)
                  }
                  aria-expanded={isExpanded}
                >
                  <ChevronDown
                    className={`h-4 w-4 mt-1 shrink-0 transition-transform ${
                      isExpanded ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="font-medium block truncate">{label}</span>
                    <span className="text-sm text-muted-foreground block">
                      {metaParts.join(" · ")}
                    </span>
                  </span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingRemoveId(stored.id)}
                  aria-label={`Remove ${label}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
              {isExpanded && (
                <div className="border-t p-3">
                  <ReceiptDetails
                    receipt={receipt}
                    lockCurrency={receipts.length > 1}
                    onReceiptUpdate={(updated) =>
                      onReceiptUpdate(stored.id, updated)
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog
        open={pendingRemoveId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove receipt?</DialogTitle>
            <DialogDescription>
              {pendingRemove
                ? `Remove ${receiptDisplayName(pendingRemove, receipts)} from this split? People and groups will be kept.`
                : "Remove this receipt from the split?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemoveId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingRemoveId) {
                  onRemoveReceipt(pendingRemoveId);
                }
                setPendingRemoveId(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
