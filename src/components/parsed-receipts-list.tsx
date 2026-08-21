import { useEffect, useState } from "react";
import { ChevronDown, Trash2, FileText } from "lucide-react";
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
import { receiptDisplayName } from "@/lib/receipt-labels";
import { getThumbnails } from "@/lib/receipt-thumbnails";
import { type Receipt, type StoredReceipt } from "@/types";

interface ParsedReceiptsListProps {
  receipts: StoredReceipt[];
  onReceiptUpdate: (receiptId: string, receipt: Receipt) => boolean | void;
  onRemoveReceipt: (receiptId: string) => void;
}

export function ParsedReceiptsList({
  receipts,
  onReceiptUpdate,
  onRemoveReceipt,
}: ParsedReceiptsListProps) {
  const lastId = receipts[receipts.length - 1]?.id ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(lastId);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  // Snapshot of the thumbnail cache; re-read whenever the receipt set changes
  // so newly accepted receipts pick up their persisted thumbnail.
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    setThumbnails(getThumbnails());
  }, [receipts]);

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
                  {thumbnails[stored.id] ? (
                    <img
                      src={thumbnails[stored.id]}
                      alt={`${label} receipt preview`}
                      className="h-12 w-12 rounded object-cover border shrink-0"
                    />
                  ) : (
                    <FileText
                      aria-hidden="true"
                      className="h-6 w-6 mt-0.5 shrink-0 text-muted-foreground"
                    />
                  )}
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
