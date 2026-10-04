"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ReceiptText, RotateCcw } from "lucide-react";

import { ReceiptUploader } from "@/components/receipt-uploader";
import { ParsedReceiptsList } from "@/components/parsed-receipts-list";
import { PeopleManager } from "@/components/people-manager";
import { GroupManager } from "@/components/group-manager";
import { ItemAssignment } from "@/components/item-assignment";
import { ResultsSummary } from "@/components/results-summary";
import { KofiButton } from "@/components/kofi-button";
import { ValidationErrors } from "@/components/validation-errors";
import { StepHeader, StepTrigger } from "@/components/step-nav";

import {
  type Receipt,
  type Person,
  type PersonItemAssignment,
  type ReceiptState,
  type Group,
} from "@/types";
import {
  getUnassignedItems,
  getSessionUnassigned,
  calculateSessionPersonTotals,
  calculatePerReceiptPersonTotals,
  sessionShareNote,
  sessionShareDate,
  validateSessionAssignments,
  validateSessionInvariants,
  sessionCurrency,
  validateReceiptCurrency,
  distributeEqualShares,
} from "@/lib/receipt-utils";
import { MAX_RECEIPTS_PER_SESSION } from "@/lib/constants";
import {
  UNTITLED_RECEIPT_NAME,
  receiptRestaurantName,
  receiptSubtitle,
} from "@/lib/receipt-labels";
import {
  getUniqueGroupEmoji,
  getRandomGroupEmojiExcluding,
} from "@/lib/emoji-utils";
import {
  RECEIPT_IMAGE_STORAGE_KEY,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/storage";
import {
  clearThumbnails,
  migrateLegacyImage,
  pruneThumbnails,
  removeThumbnail,
} from "@/lib/receipt-thumbnails";
import {
  SESSION_STORAGE_KEY,
  emptyReceiptState,
  serializeSession,
  deserializeSession,
  isDefaultSession,
} from "@/lib/session-persistence";

type ParseResult =
  | { status: "added"; next: ReceiptState }
  | { status: "capped"; next: ReceiptState }
  | { status: "mismatch"; next: ReceiptState; pinned: string };

function addParsedReceipt(prev: ReceiptState, receipt: Receipt): ParseResult {
  if (prev.receipts.length >= MAX_RECEIPTS_PER_SESSION) {
    return { status: "capped", next: prev };
  }

  const pinned = sessionCurrency(prev.receipts);
  if (!validateReceiptCurrency(receipt, pinned)) {
    return { status: "mismatch", next: prev, pinned: pinned as string };
  }

  const id = crypto.randomUUID();
  const nextAssigned = new Map(prev.assignedItems);
  nextAssigned.set(id, new Map());
  const nextReceipts = [...prev.receipts, { id, receipt }];
  // Keep people/groups even when this is the only receipt (retry after a
  // full clear is the same outing; New Split is what starts a new one).
  return {
    status: "added",
    next: {
      ...prev,
      receipts: nextReceipts,
      assignedItems: nextAssigned,
      people: calculateSessionPersonTotals(
        nextReceipts,
        prev.people,
        nextAssigned
      ),
      error: null,
    },
  };
}

/** Pinned currency from other receipts, when an edit would diverge. */
function currencyChangeConflict(
  receipts: ReceiptState["receipts"],
  receiptId: string,
  updatedReceipt: Receipt
): string | undefined {
  const existing = receipts.find((stored) => stored.id === receiptId);
  if (!existing || existing.receipt.currency === updatedReceipt.currency) {
    return undefined;
  }
  const pinned = sessionCurrency(receipts.filter((stored) => stored.id !== receiptId));
  if (pinned && !validateReceiptCurrency(updatedReceipt, pinned)) {
    return pinned;
  }
  return undefined;
}

function removeReceiptFromState(
  prev: ReceiptState,
  receiptId: string
): ReceiptState {
  const nextReceipts = prev.receipts.filter((stored) => stored.id !== receiptId);
  const nextAssigned = new Map(prev.assignedItems);
  nextAssigned.delete(receiptId);
  return {
    ...prev,
    receipts: nextReceipts,
    assignedItems: nextAssigned,
    people: calculateSessionPersonTotals(
      nextReceipts,
      prev.people,
      nextAssigned
    ),
  };
}

function updateReceiptInState(
  prev: ReceiptState,
  receiptId: string,
  updatedReceipt: Receipt,
  remappedAssignments?: Map<number, PersonItemAssignment[]>
): ReceiptState {
  const existing = prev.receipts.find((stored) => stored.id === receiptId);
  if (!existing) return prev;
  if (currencyChangeConflict(prev.receipts, receiptId, updatedReceipt)) {
    return prev;
  }

  const nextReceipts = prev.receipts.map((stored) =>
    stored.id === receiptId ? { ...stored, receipt: updatedReceipt } : stored
  );

  const nextOuter = new Map(prev.assignedItems);
  if (remappedAssignments) {
    nextOuter.set(receiptId, remappedAssignments);
  }

  return {
    ...prev,
    receipts: nextReceipts,
    assignedItems: nextOuter,
    people: calculateSessionPersonTotals(
      nextReceipts,
      prev.people,
      nextOuter
    ),
  };
}

export default function Home() {
  const [state, setState] = useState<ReceiptState>(emptyReceiptState);
  const [activeTab, setActiveTab] = useState("upload");
  const [hasSession, setHasSession] = useState(false);
  const isFirstLoad = useRef(true);
  const [resetImageTrigger, setResetImageTrigger] = useState(0);
  const [confirmNewSplit, setConfirmNewSplit] = useState(false);
  const stateRef = useRef(state);

  const commitState = (next: ReceiptState) => {
    stateRef.current = next;
    setState(next);
  };

  const activeReceipt = state.receipts[0]?.receipt ?? null;

  const validationResult = useMemo(() => {
    return validateSessionInvariants(
      state.receipts,
      state.assignedItems,
      state.people
    );
  }, [state.receipts, state.assignedItems, state.people]);

  const receiptBreakdown = useMemo(
    () =>
      calculatePerReceiptPersonTotals(
        state.receipts,
        state.people,
        state.assignedItems
      ).map(({ stored, people }) => ({
        name: stored.receipt.restaurant || UNTITLED_RECEIPT_NAME,
        date: stored.receipt.date,
        people,
      })),
    [state.receipts, state.people, state.assignedItems]
  );

  // Restore session from localStorage on mount
  useEffect(() => {
    const session = safeGetItem(SESSION_STORAGE_KEY);
    if (session) {
      const restored = deserializeSession(session);
      if (restored) {
        commitState(restored.state);
        // Re-attach any thumbnails orphaned by a corrupted/rolled-back blob,
        // then migrate the legacy singular image key onto the newest receipt.
        pruneThumbnails(restored.state.receipts.map((r) => r.id));
        migrateLegacyImage(
          restored.state.receipts[restored.state.receipts.length - 1]?.id
        );
        const restoredTab = restored.activeTab || "upload";
        const restoredAssigned = validateSessionAssignments(
          restored.state.receipts,
          restored.state.assignedItems
        );
        if (restoredTab === "results" && !restoredAssigned) {
          setActiveTab(
            restored.state.people.length > 0 ? "assign" : "people"
          );
        } else {
          setActiveTab(restoredTab);
        }
        setHasSession(!isDefaultSession(restored.state, restored.activeTab || "upload"));
      } else {
        setHasSession(false);
      }
    } else {
      setHasSession(false);
    }
  }, []);

  // Save session to localStorage on state or tab change
  useEffect(() => {
    // Skip the initial mount so we don't serialize empty state over a restored session.
    // Restore and save both run after first paint; flipping this flag in the restore
    // effect would let save run in the same cycle with the default empty state.
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    // Only save if not loading
    if (!state.isLoading) {
      const serialized = serializeSession(state, activeTab);
      const ok = safeSetItem(SESSION_STORAGE_KEY, serialized);
      if (!ok) {
        // Quota exhausted — evict cached images (largest consumers) and retry once
        safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
        clearThumbnails();
        safeSetItem(SESSION_STORAGE_KEY, serialized);
      }
      setHasSession(!isDefaultSession(state, activeTab));
    }
  }, [state, activeTab]);

  // Handler for New Split button
  const handleNewSplit = () => {
    safeRemoveItem(SESSION_STORAGE_KEY);
    safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
    clearThumbnails();
    const empty = emptyReceiptState();
    commitState(empty);
    setActiveTab("upload");
    setHasSession(false);
    setResetImageTrigger((v) => v + 1);
    setConfirmNewSplit(false);
  };

  // Check if all items are assigned
  const allItemsAssigned = validateSessionAssignments(
    state.receipts,
    state.assignedItems
  );

  useEffect(() => {
    if (activeTab !== "results" || allItemsAssigned) return;
    if (state.people.length > 0) {
      setActiveTab("assign");
    } else if (state.receipts.length > 0) {
      setActiveTab("people");
    } else {
      setActiveTab("upload");
    }
  }, [activeTab, allItemsAssigned, state.people.length, state.receipts.length]);

  const itemProgress = useMemo(() => {
    const total = state.receipts.reduce(
      (n, r) => n + r.receipt.items.length,
      0
    );
    const unassigned = getSessionUnassigned(
      state.receipts,
      state.assignedItems
    ).length;
    return { total, unassigned };
  }, [state.receipts, state.assignedItems]);

  // Handle receipt upload — append to the current outing (people/groups stay).
  // Returns the new receipt id so the uploader can key its thumbnail to it.
  const handleReceiptParsed = (receipt: Receipt): string | false => {
    const result = addParsedReceipt(stateRef.current, receipt);
    if (result.status === "capped") {
      toast.error(
        `This split already has ${MAX_RECEIPTS_PER_SESSION} receipts. Remove one to add another.`
      );
      return false;
    }
    if (result.status === "mismatch") {
      toast.error(
        `This receipt is ${receipt.currency}, but this split is in ${result.pinned}.`
      );
      return false;
    }
    commitState(result.next);
    toast.success("Receipt successfully parsed!");
    return result.next.receipts[result.next.receipts.length - 1].id;
  };

  const handleRemoveReceipt = (receiptId: string) => {
    removeThumbnail(receiptId);
    commitState(removeReceiptFromState(stateRef.current, receiptId));
    toast.success("Receipt removed");
  };

  // Handle people changes
  const handlePeopleChange = (updatedPeople: Person[]) => {
    const prevState = stateRef.current;
    let nextAssigned = prevState.assignedItems;

    // If we're removing a person, we need to update the assigned items
    if (prevState.people.length > updatedPeople.length) {
      const removedIds = new Set(
        prevState.people
          .filter((p) => !updatedPeople.some((up) => up.id === p.id))
          .map((p) => p.id)
      );

      // Clone outer map AND each inner map we change (shallow Map clone is not enough)
      const nextOuter = new Map(prevState.assignedItems);
      for (const [receiptId, inner] of prevState.assignedItems) {
        const nextInner = new Map(inner);
        nextInner.forEach((assignments, itemIndex) => {
          const updatedAssignments = assignments.filter(
            (a) => !removedIds.has(a.personId)
          );
          if (updatedAssignments.length === 0) {
            nextInner.delete(itemIndex);
          } else {
            nextInner.set(itemIndex, updatedAssignments);
          }
        });
        nextOuter.set(receiptId, nextInner);
      }
      nextAssigned = nextOuter;
    }

    const next = {
      ...prevState,
      people: calculateSessionPersonTotals(
        prevState.receipts,
        updatedPeople,
        nextAssigned
      ),
      assignedItems: nextAssigned,
    };
    commitState(next);
  };

  // Handle receipt updates. Currency mismatches are rejected like uploads.
  const handleReceiptUpdate = (
    receiptId: string,
    updatedReceipt: Receipt,
    remappedAssignments?: Map<number, PersonItemAssignment[]>
  ): boolean => {
    const pinned = currencyChangeConflict(
      stateRef.current.receipts,
      receiptId,
      updatedReceipt
    );
    if (pinned) {
      toast.error(
        `This receipt is ${updatedReceipt.currency}, but this split is in ${pinned}.`
      );
      return false;
    }
    commitState(
      updateReceiptInState(
        stateRef.current,
        receiptId,
        updatedReceipt,
        remappedAssignments
      )
    );
    return true;
  };

  // Handle item assignments for a specific receipt
  const handleAssignItems = (
    receiptId: string,
    itemIndex: number,
    assignments: PersonItemAssignment[]
  ) => {
    const prevState = stateRef.current;
    if (!prevState.receipts.some((stored) => stored.id === receiptId)) {
      return;
    }

    const nextOuter = new Map(prevState.assignedItems);
    const inner = new Map(nextOuter.get(receiptId) ?? []);

    if (assignments.length === 0) {
      inner.delete(itemIndex);
    } else {
      inner.set(itemIndex, assignments);
    }
    nextOuter.set(receiptId, inner);

    const next = {
      ...prevState,
      assignedItems: nextOuter,
      people: calculateSessionPersonTotals(
        prevState.receipts,
        prevState.people,
        nextOuter
      ),
    };
    commitState(next);
  };

  // Update loading state
  const setIsLoading = (isLoading: boolean) => {
    commitState({
      ...stateRef.current,
      isLoading,
    });
  };

  // Handle group creation
  const handleGroupCreate = (name: string, memberIds: string[]) => {
    // Get emojis already used by existing groups for uniqueness
    const existingEmojis = stateRef.current.groups
      .map((group) => group.emoji)
      .filter(Boolean) as string[];

    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: name.trim(),
      memberIds,
      emoji: getUniqueGroupEmoji(existingEmojis),
    };

    commitState({
      ...stateRef.current,
      groups: [...stateRef.current.groups, newGroup],
    });
  };

  // Handle group update
  const handleGroupUpdate = (groupId: string, updates: Partial<Group>) => {
    commitState({
      ...stateRef.current,
      groups: stateRef.current.groups.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group
      ),
    });
  };

  // Handle group deletion
  const handleGroupDelete = (groupId: string) => {
    commitState({
      ...stateRef.current,
      groups: stateRef.current.groups.filter((group) => group.id !== groupId),
    });
  };

  // Handle emoji regeneration for a group
  const handleGroupEmojiRegenerate = (groupId: string) => {
    const group = stateRef.current.groups.find((g) => g.id === groupId);
    if (!group) return;

    const newEmoji = getRandomGroupEmojiExcluding(group.emoji);

    commitState({
      ...stateRef.current,
      groups: stateRef.current.groups.map((g) =>
        g.id === groupId ? { ...g, emoji: newEmoji } : g
      ),
    });
  };

  // Navigate to the next tab
  const goToNextTab = () => {
    switch (activeTab) {
      case "upload":
        setActiveTab("people");
        break;
      case "people":
        setActiveTab("assign");
        break;
      case "assign":
        setActiveTab("results");
        break;
    }
  };

  // Navigate to the previous tab
  const goToPreviousTab = () => {
    switch (activeTab) {
      case "people":
        setActiveTab("upload");
        break;
      case "assign":
        setActiveTab("people");
        break;
      case "results":
        setActiveTab("assign");
        break;
    }
  };

  // Check if can proceed to next tab
  const canGoToNextTab = (): boolean => {
    switch (activeTab) {
      case "upload":
        return state.receipts.length > 0;
      case "people":
        return state.people.length > 0;
      case "assign":
        return allItemsAssigned;
      default:
        return false;
    }
  };

  // Split unassigned items on one receipt evenly among all people
  const splitItemsEvenlyForReceipt = (receiptId: string) => {
    const prevState = stateRef.current;
    const stored = prevState.receipts.find((r) => r.id === receiptId);
    if (!stored || prevState.people.length === 0) return;

    const inner = new Map(prevState.assignedItems.get(receiptId) ?? []);
    const currentlyUnassigned = getUnassignedItems(stored.receipt, inner);

    if (currentlyUnassigned.length === 0) {
      toast.info("No unassigned items to split evenly!");
      return;
    }

    const equalAssignments = distributeEqualShares(
      prevState.people.map((p) => p.id)
    );
    currentlyUnassigned.forEach((itemIndex) => {
      inner.set(itemIndex, equalAssignments.map((a) => ({ ...a })));
    });

    const nextOuter = new Map(prevState.assignedItems);
    nextOuter.set(receiptId, inner);

    toast.success(
      `Split remaining items on ${receiptRestaurantName(stored)}.`
    );

    const next = {
      ...prevState,
      assignedItems: nextOuter,
      people: calculateSessionPersonTotals(
        prevState.receipts,
        prevState.people,
        nextOuter
      ),
    };
    commitState(next);
  };

  const hasReceipt = state.receipts.length > 0;
  const canViewResults =
    hasReceipt && state.people.length > 0 && allItemsAssigned;
  const currencyCode = sessionCurrency(state.receipts);
  const receiptCountLabel = `${state.receipts.length} ${
    state.receipts.length === 1 ? "receipt" : "receipts"
  }`;
  const peopleCountLabel = `${state.people.length} ${
    state.people.length === 1 ? "person" : "people"
  }`;

  const footer: Record<string, { hint: string; next?: string }> = {
    upload: {
      hint: hasReceipt
        ? `${receiptCountLabel} · ${currencyCode ?? "USD"}`
        : "Add a receipt to continue",
      next: "Add people",
    },
    people: {
      hint:
        state.people.length === 0
          ? "Add at least one person"
          : `${peopleCountLabel} · ${receiptCountLabel}`,
      next: "Assign items",
    },
    assign: {
      hint:
        itemProgress.unassigned > 0
          ? `${itemProgress.unassigned} of ${itemProgress.total} ${
              itemProgress.total === 1 ? "item" : "items"
            } left`
          : "All items assigned",
      next: "See totals",
    },
    results: {
      hint: "Ready to share",
    },
  };
  const currentFooter = footer[activeTab] ?? footer.upload;
  const showFooter = activeTab !== "upload" || hasReceipt;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <ReceiptText className="size-4" />
            </span>
            <h1 className="text-base font-semibold tracking-tight">
              Receipt Splitter
            </h1>
          </div>
          {hasSession && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmNewSplit(true)}
              className="text-muted-foreground"
            >
              <RotateCcw />
              New split
            </Button>
          )}
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-3xl flex-1 px-4 pt-6 sm:pt-8 ${
          showFooter ? "pb-28" : "pb-10"
        }`}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-7 sm:gap-9">
          <TabsList
            aria-label="Steps"
            className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl border bg-muted/70 p-1"
          >
            <StepTrigger value="upload" step={1} label="Receipts" complete={hasReceipt} />
            <StepTrigger
              value="people"
              step={2}
              label="People"
              disabled={!hasReceipt}
              complete={state.people.length > 0}
            />
            <StepTrigger
              value="assign"
              step={3}
              label="Assign"
              disabled={!hasReceipt || state.people.length === 0}
              complete={hasReceipt && allItemsAssigned}
            />
            <StepTrigger
              value="results"
              step={4}
              label="Totals"
              disabled={!canViewResults}
            />
          </TabsList>

          <TabsContent value="upload" className="flex flex-col gap-5">
            <StepHeader
              title={hasReceipt ? "Your receipts" : "Split a receipt in seconds"}
              description={
                hasReceipt
                  ? "Add more from the same outing, or check the details below."
                  : "Upload a photo or PDF. We'll read the items, tax, and tip for you."
              }
            />
            <ReceiptUploader
              onReceiptParsed={handleReceiptParsed}
              isLoading={state.isLoading}
              setIsLoading={setIsLoading}
              resetImageTrigger={resetImageTrigger}
              maxRemaining={MAX_RECEIPTS_PER_SESSION - state.receipts.length}
              hasReceipts={hasReceipt}
            />

            <ParsedReceiptsList
              receipts={state.receipts}
              onReceiptUpdate={(id, receipt) => handleReceiptUpdate(id, receipt)}
              onRemoveReceipt={handleRemoveReceipt}
            />
          </TabsContent>

          <TabsContent value="people" className="flex flex-col gap-5">
            <StepHeader
              title="Who's splitting?"
              description="Add everyone who shared the bill."
            />
            <Card className="gap-0 py-0">
              <CardContent className="flex flex-col divide-y p-0">
                <PeopleManager
                  people={state.people}
                  onPeopleChange={handlePeopleChange}
                />
                <GroupManager
                  people={state.people}
                  groups={state.groups}
                  onGroupCreate={handleGroupCreate}
                  onGroupUpdate={handleGroupUpdate}
                  onGroupDelete={handleGroupDelete}
                  onGroupEmojiRegenerate={handleGroupEmojiRegenerate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assign" className="flex flex-col gap-5">
            <StepHeader
              title="Who had what?"
              description="Pick who had each item. Shared items split evenly."
            />
            {state.receipts.map((stored) => {
              const inner = state.assignedItems.get(stored.id) ?? new Map();
              const unassigned = getUnassignedItems(stored.receipt, inner);
              return (
                <ItemAssignment
                  key={stored.id}
                  receipt={stored.receipt}
                  title={receiptRestaurantName(stored)}
                  subtitle={receiptSubtitle(stored, state.receipts)}
                  people={state.people}
                  groups={state.groups}
                  assignedItems={inner}
                  unassignedItems={unassigned}
                  onAssignItems={(itemIndex, assignments) =>
                    handleAssignItems(stored.id, itemIndex, assignments)
                  }
                  onReceiptUpdate={(receipt, remapped) =>
                    handleReceiptUpdate(stored.id, receipt, remapped)
                  }
                  onSplitEvenly={() => splitItemsEvenlyForReceipt(stored.id)}
                />
              );
            })}
          </TabsContent>

          <TabsContent value="results" className="flex flex-col gap-5">
            <StepHeader
              title="Who owes what"
              description="Tax and tip are split in proportion to what each person ordered."
            />
            <ValidationErrors
              errors={validationResult.errors}
              currencyCode={activeReceipt?.currency}
            />

            <ResultsSummary
              people={state.people}
              receiptName={sessionShareNote(state.receipts)}
              receiptDate={sessionShareDate(state.receipts)}
              currencyCode={currencyCode}
              validationResult={validationResult}
              receiptBreakdown={receiptBreakdown}
            />
          </TabsContent>
        </Tabs>

        <KofiButton className="mt-10 flex justify-center" />
      </main>

      {showFooter && (
        <nav
          aria-label="Step navigation"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/75"
        >
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
            {activeTab !== "upload" && (
              <Button
                variant="outline"
                onClick={goToPreviousTab}
                aria-label="Back"
                className="shrink-0"
              >
                <ArrowLeft />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}
            <p
              className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight text-muted-foreground"
              aria-live="polite"
            >
              {currentFooter.hint}
            </p>
            {currentFooter.next && (
              <Button
                onClick={goToNextTab}
                disabled={!canGoToNextTab()}
                className="shrink-0"
              >
                {currentFooter.next}
                <ArrowRight />
              </Button>
            )}
          </div>
        </nav>
      )}

      <Dialog open={confirmNewSplit} onOpenChange={setConfirmNewSplit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new split?</DialogTitle>
            <DialogDescription>
              This clears all receipts, people, and assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNewSplit(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleNewSplit}>
              Start over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
