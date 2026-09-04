"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, UploadCloud, Users, ListChecks, DollarSign } from "lucide-react";

import { ReceiptUploader } from "@/components/receipt-uploader";
import { ParsedReceiptsList } from "@/components/parsed-receipts-list";
import { PeopleManager } from "@/components/people-manager";
import { GroupManager } from "@/components/group-manager";
import { ItemAssignment } from "@/components/item-assignment";
import { ResultsSummary } from "@/components/results-summary";
import { PersonItems } from "@/components/person-items";
import { KofiButton } from "@/components/kofi-button";
import { ValidationErrors } from "@/components/validation-errors";

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
        name: stored.receipt.restaurant || "Untitled receipt",
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

  // Calculate progress across every receipt in the session
  const calculateProgress = (): number => {
    if (state.receipts.length === 0) return 0;

    const totalItems = state.receipts.reduce(
      (n, r) => n + r.receipt.items.length,
      0
    );
    const unassigned = getSessionUnassigned(state.receipts, state.assignedItems);
    return totalItems === 0
      ? 100
      : ((totalItems - unassigned.length) / totalItems) * 100;
  };

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

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="w-full sm:w-auto">
          <h1 className="text-3xl font-bold mb-2">Receipt Splitter</h1>
          <p className="text-muted-foreground">
            Upload receipts, add people, and split the day
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSplit}
            disabled={!hasSession}
            className="flex items-center gap-1"
            title={
              hasSession
                ? "Start a new split (clear session)"
                : "No session to clear"
            }
          >
            New Split
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousTab}
            disabled={activeTab === "upload"}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={goToNextTab}
            disabled={!canGoToNextTab()}
            className="flex items-center gap-1"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 mb-2">
          <TabsList className="w-full overflow-x-auto scrollbar-hide">
            <TabsTrigger value="upload" className="gap-1.5 sm:gap-2">
              <UploadCloud className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden">Upload</span>
              <span className="hidden sm:inline">Upload Receipts</span>
            </TabsTrigger>
            <TabsTrigger value="people" disabled={!hasReceipt} className="gap-1.5 sm:gap-2">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden">People</span>
              <span className="hidden sm:inline">Add People</span>
            </TabsTrigger>
            <TabsTrigger
              value="assign"
              disabled={!hasReceipt || state.people.length === 0}
              className="gap-1.5 sm:gap-2"
            >
              <ListChecks className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden">Items</span>
              <span className="hidden sm:inline">Assign Items</span>
            </TabsTrigger>
            <TabsTrigger
              value="results"
              disabled={!canViewResults}
              className="gap-1.5 sm:gap-2"
            >
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden">Results</span>
              <span className="hidden sm:inline">Results</span>
            </TabsTrigger>
          </TabsList>

          {hasReceipt && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Progress
                value={calculateProgress()}
                className="w-full sm:w-48"
              />
              <span className="text-sm whitespace-nowrap w-12">
                {Math.round(calculateProgress())}%
              </span>
            </div>
          )}
        </div>

        <TabsContent value="upload" className="space-y-6">
          <ReceiptUploader
            onReceiptParsed={handleReceiptParsed}
            isLoading={state.isLoading}
            setIsLoading={setIsLoading}
            resetImageTrigger={resetImageTrigger}
            maxRemaining={MAX_RECEIPTS_PER_SESSION - state.receipts.length}
          />

          <ParsedReceiptsList
            receipts={state.receipts}
            onReceiptUpdate={(id, receipt) => handleReceiptUpdate(id, receipt)}
            onRemoveReceipt={handleRemoveReceipt}
          />
        </TabsContent>

        <TabsContent value="people" className="space-y-6">
          {state.receipts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {state.receipts.length}{" "}
              {state.receipts.length === 1 ? "receipt" : "receipts"} ·{" "}
              {sessionCurrency(state.receipts) ?? "USD"}
            </p>
          )}

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
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
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

        <TabsContent value="results" className="space-y-6">
          <ValidationErrors errors={validationResult.errors} currencyCode={activeReceipt?.currency} />

          <ResultsSummary
            people={state.people}
            receiptName={sessionShareNote(state.receipts)}
            receiptDate={sessionShareDate(state.receipts)}
            currencyCode={sessionCurrency(state.receipts)}
            validationResult={validationResult}
            receiptBreakdown={receiptBreakdown}
          />

          <PersonItems people={state.people} currencyCode={sessionCurrency(state.receipts)} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center w-full mt-4">
        <KofiButton />
      </div>
    </main>
  );
}
