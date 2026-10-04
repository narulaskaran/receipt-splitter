import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptDetails } from "@/components/receipt-details";
import { ReceiptThumbnail } from "@/components/receipt-thumbnail";
import { formatCurrency } from "@/lib/receipt-utils";
import { MAX_RECEIPTS_PER_SESSION } from "@/lib/constants";
import { receiptDisplayName } from "@/lib/receipt-labels";
import {
  EMPTY_THUMBNAILS,
  getThumbnails,
  subscribeThumbnails,
} from "@/lib/receipt-thumbnails";
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
  const thumbnails = useSyncExternalStore(
    subscribeThumbnails,
    getThumbnails,
    () => EMPTY_THUMBNAILS
  );

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
      : null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <h3 className="font-medium">Receipts</h3>
        <span className="text-muted-foreground tabular-nums">
          {receipts.length} of {MAX_RECEIPTS_PER_SESSION}
        </span>
      </div>
      <ul className="divide-y border-t">
        {receipts.map((stored) => {
          const { receipt } = stored;
          const itemCount = receipt.items.length;
          const isExpanded = stored.id === visibleExpandedId;
          const label = receiptDisplayName(stored, receipts);
          const metaParts = [
            receipt.date || null,
            `${itemCount} ${itemCount === 1 ? "item" : "items"}`,
            formatCurrency(receipt.total, receipt.currency),
          ].filter(Boolean);

          return (
            <li key={stored.id}>
              <div className="flex items-center gap-2 py-2 pr-2 pl-4">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : stored.id)
                  }
                  aria-expanded={isExpanded}
                >
                  <ReceiptThumbnail
                    variant="row"
                    src={thumbnails[stored.id]}
                    alt={`${label} receipt preview`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{label}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {metaParts.join(" · ")}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingRemoveId(stored.id)}
                  aria-label={`Remove ${label}`}
                  title="Remove receipt"
                >
                  <Trash2 />
                </Button>
              </div>
              {isExpanded && (
                <div className="border-t bg-muted/40 px-4 py-4">
                  <ReceiptDetails
                    receipt={receipt}
                    thumbnailUrl={thumbnails[stored.id]}
                    thumbnailAlt={`${label} receipt image`}
                    onReceiptUpdate={(updated) =>
                      onReceiptUpdate(stored.id, updated)
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
