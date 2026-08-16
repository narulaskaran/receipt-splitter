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
  type ItemAssignments,
} from "@/types";
import {
  getUnassignedItems,
  calculateSessionPersonTotals,
  validateSessionAssignments,
  validateSessionInvariants,
  sessionCurrency,
  validateReceiptCurrency,
} from "@/lib/receipt-utils";
import { MAX_RECEIPTS_PER_SESSION } from "@/lib/constants";
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
  if (prev.receipts.length === 0) {
    return {
      status: "added",
      next: {
        receipts: [{ id, receipt }],
        people: [],
        groups: [],
        assignedItems: new Map([[id, new Map()]]),
        isLoading: prev.isLoading,
        error: null,
      },
    };
  }

  const nextAssigned = new Map(prev.assignedItems);
  nextAssigned.set(id, new Map());
  const nextReceipts = [...prev.receipts, { id, receipt }];
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

  const currencyChanged = existing.receipt.currency !== updatedReceipt.currency;
  const nextReceipts = prev.receipts.map((stored) => {
    if (stored.id === receiptId) {
      return { ...stored, receipt: updatedReceipt };
    }
    if (currencyChanged) {
      return {
        ...stored,
        receipt: { ...stored.receipt, currency: updatedReceipt.currency },
      };
    }
    return stored;
  });

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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activeReceipt = state.receipts[0]?.receipt ?? null;
  const activeId = state.receipts[0]?.id;
  const activeAssignments: ItemAssignments = activeId
    ? (state.assignedItems.get(activeId) ?? new Map())
    : new Map();
  const unassignedItems = activeReceipt
    ? getUnassignedItems(activeReceipt, activeAssignments)
    : [];

  const validationResult = useMemo(() => {
    return validateSessionInvariants(
      state.receipts,
      state.assignedItems,
      state.people
    );
  }, [state.receipts, state.assignedItems, state.people]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const session = safeGetItem(SESSION_STORAGE_KEY);
    if (session) {
      const restored = deserializeSession(session);
      if (restored) {
        setState(restored.state);
        setActiveTab(restored.activeTab || "upload");
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
        // Quota exhausted — evict the cached image (largest consumer) and retry once
        safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
        safeSetItem(SESSION_STORAGE_KEY, serialized);
      }
      setHasSession(!isDefaultSession(state, activeTab));
    }
  }, [state, activeTab]);

  // Handler for New Split button
  const handleNewSplit = () => {
    safeRemoveItem(SESSION_STORAGE_KEY);
    safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
    const empty = emptyReceiptState();
    stateRef.current = empty;
    setState(empty);
    setActiveTab("upload");
    setHasSession(false);
    setResetImageTrigger((v) => v + 1);
  };

  // Check if all items are assigned
  const allItemsAssigned = validateSessionAssignments(
    state.receipts,
    state.assignedItems
  );

  // Calculate progress
  const calculateProgress = (): number => {
    if (!activeReceipt) return 0;

    const totalItems = activeReceipt.items.length;
    if (totalItems === 0) return 100;

    const assignedItemCount = totalItems - unassignedItems.length;
    return (assignedItemCount / totalItems) * 100;
  };

  // Handle receipt upload — first receipt starts a new outing; later ones append
  const handleReceiptParsed = (receipt: Receipt) => {
    const result = addParsedReceipt(stateRef.current, receipt);
    if (result.status === "capped") {
      toast.error(
        `This split already has ${MAX_RECEIPTS_PER_SESSION} receipts. Remove one to add another.`
      );
      return;
    }
    if (result.status === "mismatch") {
      toast.error(
        `This receipt is ${receipt.currency}, but this split is in ${result.pinned}.`
      );
      return;
    }
    stateRef.current = result.next;
    setState(result.next);
    toast.success("Receipt successfully parsed!");
  };

  const handleRemoveReceipt = (receiptId: string) => {
    setState((prevState) => {
      const next = removeReceiptFromState(prevState, receiptId);
      stateRef.current = next;
      return next;
    });
    toast.success("Receipt removed");
  };

  // Handle people changes
  const handlePeopleChange = (updatedPeople: Person[]) => {
    setState((prevState) => {
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
      stateRef.current = next;
      return next;
    });
  };

  // Handle receipt updates (currency changes are copied onto every receipt)
  const handleReceiptUpdate = (
    receiptId: string,
    updatedReceipt: Receipt,
    remappedAssignments?: Map<number, PersonItemAssignment[]>
  ) => {
    setState((prevState) => {
      const next = updateReceiptInState(
        prevState,
        receiptId,
        updatedReceipt,
        remappedAssignments
      );
      stateRef.current = next;
      return next;
    });
  };

  // Handle item assignments
  const handleAssignItems = (
    itemIndex: number,
    assignments: PersonItemAssignment[]
  ) => {
    setState((prevState) => {
      const receiptId = prevState.receipts[0]?.id;
      if (!receiptId) return prevState;

      const nextOuter = new Map(prevState.assignedItems);
      const inner = new Map(nextOuter.get(receiptId) ?? []);

      if (assignments.length === 0) {
        inner.delete(itemIndex);
      } else {
        inner.set(itemIndex, assignments);
      }
      nextOuter.set(receiptId, inner);

      return {
        ...prevState,
        assignedItems: nextOuter,
        people: calculateSessionPersonTotals(
          prevState.receipts,
          prevState.people,
          nextOuter
        ),
      };
    });
  };

  // Update loading state
  const setIsLoading = (isLoading: boolean) => {
    setState((prevState) => {
      const next = {
        ...prevState,
        isLoading,
      };
      stateRef.current = next;
      return next;
    });
  };

  // Handle group creation
  const handleGroupCreate = (name: string, memberIds: string[]) => {
    // Get emojis already used by existing groups for uniqueness
    const existingEmojis = state.groups
      .map((group) => group.emoji)
      .filter(Boolean) as string[];

    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: name.trim(),
      memberIds,
      emoji: getUniqueGroupEmoji(existingEmojis),
    };

    setState((prevState) => ({
      ...prevState,
      groups: [...prevState.groups, newGroup],
    }));
  };

  // Handle group update
  const handleGroupUpdate = (groupId: string, updates: Partial<Group>) => {
    setState((prevState) => ({
      ...prevState,
      groups: prevState.groups.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group
      ),
    }));
  };

  // Handle group deletion
  const handleGroupDelete = (groupId: string) => {
    setState((prevState) => ({
      ...prevState,
      groups: prevState.groups.filter((group) => group.id !== groupId),
    }));
  };

  // Handle emoji regeneration for a group
  const handleGroupEmojiRegenerate = (groupId: string) => {
    setState((prevState) => {
      const group = prevState.groups.find((g) => g.id === groupId);
      if (!group) return prevState;

      const newEmoji = getRandomGroupEmojiExcluding(group.emoji);

      return {
        ...prevState,
        groups: prevState.groups.map((g) =>
          g.id === groupId ? { ...g, emoji: newEmoji } : g
        ),
      };
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

  // Split all unassigned items evenly among all people
  const splitAllItemsEvenly = () => {
    if (state.receipts.length === 0 || state.people.length === 0) return;

    setState((prevState) => {
      const receiptId = prevState.receipts[0]?.id;
      const receipt = prevState.receipts[0]?.receipt;
      if (!receiptId || !receipt) return prevState;

      const inner = new Map(prevState.assignedItems.get(receiptId) ?? []);
      const currentlyUnassigned = getUnassignedItems(receipt, inner);

      // No unassigned items — nothing to do
      if (currentlyUnassigned.length === 0) {
        toast.info("No unassigned items to split evenly!");
        return prevState;
      }

      // Calculate equal share percentage with 2 decimal places
      const equalShare = +(100 / prevState.people.length).toFixed(2);

      // Only split unassigned items, preserving existing assignments
      currentlyUnassigned.forEach((itemIndex) => {
        // Create assignments for all people
        const assignments: PersonItemAssignment[] = [];

        // Calculate the sum to ensure it adds up to exactly 100%
        let runningSum = 0;

        prevState.people.forEach((person, personIndex) => {
          // For the last person, ensure the total is exactly 100%
          if (personIndex === prevState.people.length - 1) {
            const lastShare = +(100 - runningSum).toFixed(2);
            assignments.push({
              personId: person.id,
              sharePercentage: lastShare,
            });
          } else {
            assignments.push({
              personId: person.id,
              sharePercentage: equalShare,
            });
            runningSum += equalShare;
          }
        });

        inner.set(itemIndex, assignments);
      });

      const nextOuter = new Map(prevState.assignedItems);
      nextOuter.set(receiptId, inner);

      toast.success("All items split evenly among everyone!");

      return {
        ...prevState,
        assignedItems: nextOuter,
        people: calculateSessionPersonTotals(
          prevState.receipts,
          prevState.people,
          nextOuter
        ),
      };
    });

    // Don't automatically move to results tab anymore
    // setActiveTab("results");
  };

  const hasReceipt = state.receipts.length > 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="w-full sm:w-auto">
          <h1 className="text-3xl font-bold mb-2">Receipt Splitter</h1>
          <p className="text-muted-foreground">
            Upload a receipt, add people, and easily split items
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
              <span className="hidden sm:inline">Upload Receipt</span>
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
              disabled={!hasReceipt || state.people.length === 0}
              className="gap-1.5 sm:gap-2"
            >
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden">Results</span>
              <span className="hidden sm:inline">Results</span>
            </TabsTrigger>
          </TabsList>

          {activeReceipt && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Progress
                  value={calculateProgress()}
                  className="w-full sm:w-48"
                />
                <span className="text-sm whitespace-nowrap w-12">
                  {Math.round(calculateProgress())}%
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={splitAllItemsEvenly}
                disabled={state.people.length === 0}
                className="whitespace-nowrap w-full sm:w-auto"
              >
                Split All Evenly
              </Button>
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
          {activeReceipt && activeId && (
            <ItemAssignment
              receipt={activeReceipt}
              people={state.people}
              groups={state.groups}
              assignedItems={activeAssignments}
              unassignedItems={unassignedItems}
              onAssignItems={handleAssignItems}
              onReceiptUpdate={(receipt, remapped) =>
                handleReceiptUpdate(activeId, receipt, remapped)
              }
            />
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <ValidationErrors errors={validationResult.errors} currencyCode={activeReceipt?.currency} />

          <ResultsSummary
            people={state.people}
            receiptName={activeReceipt?.restaurant || null}
            receiptDate={activeReceipt?.date || null}
            currencyCode={activeReceipt?.currency}
            validationResult={validationResult}
          />

          <PersonItems people={state.people} currencyCode={activeReceipt?.currency} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center w-full mt-4">
        <KofiButton />
      </div>
    </main>
  );
}
