"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ReceiptUploader } from "@/components/receipt-uploader";
import { PeopleManager } from "@/components/people-manager";
import { GroupManager } from "@/components/group-manager";
import { ItemAssignment } from "@/components/item-assignment";
import { ReceiptDetails } from "@/components/receipt-details";
import { ResultsSummary } from "@/components/results-summary";
import { PersonItems } from "@/components/person-items";
import { KofiButton } from "@/components/kofi-button";

import {
  type Receipt,
  type Person,
  type PersonItemAssignment,
  type ReceiptState,
  type Group,
} from "@/types";
import {
  calculatePersonTotals,
  validateItemAssignments,
  getUnassignedItems,
} from "@/lib/receipt-utils";
import {
  getUniqueGroupEmoji,
  getRandomGroupEmojiExcluding,
} from "@/lib/emoji-utils";

export default function Home() {
  const LOCAL_STORAGE_KEY = "receiptSplitterSession";
  const [state, setState] = useState<ReceiptState>({
    originalReceipt: null,
    people: [],
    assignedItems: new Map(),
    unassignedItems: [],
    groups: [],
    isLoading: false,
    error: null,
  });
  const [activeTab, setActiveTab] = useState("upload");
  const [hasSession, setHasSession] = useState(false);
  const isFirstLoad = useRef(true);
  const [resetImageTrigger, setResetImageTrigger] = useState(0);

  const defaultSession = useMemo(
    () => ({
      state: {
        originalReceipt: null,
        people: [],
        assignedItems: [],
        unassignedItems: [],
        groups: [],
        isLoading: false,
        error: null,
      },
      activeTab: "upload",
    }),
    []
  );

  // Restore session from localStorage on mount
  useEffect(() => {
    const session = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        // Always convert assignedItems to Map if it's an array
        if (parsed.state && Array.isArray(parsed.state.assignedItems)) {
          parsed.state.assignedItems = new Map(parsed.state.assignedItems);
        }
        setState(parsed.state || parsed);
        setActiveTab(parsed.activeTab || "upload");
        const isDefault =
          JSON.stringify(parsed) === JSON.stringify(defaultSession);
        setHasSession(!isDefault);
      } catch (err) {
        console.log("Failed to restore session from localStorage", err);
      }
    } else {
      setHasSession(false);
    }
    isFirstLoad.current = false;
  }, [defaultSession]);

  // Save session to localStorage on state or tab change
  useEffect(() => {
    if (isFirstLoad.current) return;
    // Only save if not loading
    if (!state.isLoading) {
      const toSave = {
        state: {
          ...state,
          // Convert Map to array for serialization
          assignedItems: Array.from(state.assignedItems.entries()),
        },
        activeTab,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
      // Check if session is not default
      const isDefault =
        JSON.stringify(toSave) === JSON.stringify(defaultSession);
      setHasSession(!isDefault);
    }
  }, [state, activeTab, defaultSession]);

  // Handler for New Split button
  const handleNewSplit = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem("receiptSplitterImage");
    setState({
      originalReceipt: null,
      people: [],
      assignedItems: new Map(),
      unassignedItems: [],
      groups: [],
      isLoading: false,
      error: null,
    });
    setActiveTab("upload");
    setHasSession(false);
    setResetImageTrigger((v) => v + 1);
  };

  // Check if all items are assigned
  const allItemsAssigned = state.originalReceipt
    ? validateItemAssignments(state.originalReceipt, state.assignedItems)
    : false;

  // Calculate progress
  const calculateProgress = (): number => {
    if (!state.originalReceipt) return 0;

    const totalItems = state.originalReceipt.items.length;
    if (totalItems === 0) return 100;

    const assignedItemCount = totalItems - state.unassignedItems.length;
    return (assignedItemCount / totalItems) * 100;
  };

  // Handle receipt upload
  const handleReceiptParsed = (receipt: Receipt) => {
    setState({
      originalReceipt: receipt,
      people: [],
      assignedItems: new Map(),
      unassignedItems: Array.from(
        { length: receipt.items.length },
        (_, i) => i
      ),
      groups: [],
      isLoading: false,
      error: null,
    });

    // Don't auto-advance
    // setActiveTab("people");
    toast.success("Receipt successfully parsed!");
  };

  // Handle people changes
  const handlePeopleChange = (updatedPeople: Person[]) => {
    setState((prevState) => {
      // If we're removing a person, we need to update the assigned items
      if (prevState.people.length > updatedPeople.length) {
        const removedPeople = prevState.people.filter(
          (p) => !updatedPeople.some((up) => up.id === p.id)
        );

        const newAssignedItems = new Map(prevState.assignedItems);

        // Remove the assignments for the removed people
        removedPeople.forEach((person) => {
          newAssignedItems.forEach((assignments, itemIndex) => {
            const updatedAssignments = assignments.filter(
              (a) => a.personId !== person.id
            );

            if (updatedAssignments.length === 0) {
              newAssignedItems.delete(itemIndex);
            } else {
              newAssignedItems.set(itemIndex, updatedAssignments);
            }
          });
        });

        // Recalculate unassigned items
        const unassignedItems = prevState.originalReceipt
          ? getUnassignedItems(prevState.originalReceipt, newAssignedItems)
          : [];

        // Calculate new totals
        let newPeople = updatedPeople;
        if (prevState.originalReceipt) {
          newPeople = calculatePersonTotals(
            prevState.originalReceipt,
            updatedPeople,
            newAssignedItems
          );
        }

        return {
          ...prevState,
          people: newPeople,
          assignedItems: newAssignedItems,
          unassignedItems,
        };
      }

      // If we're just adding people, no need to update assignments
      return {
        ...prevState,
        people: updatedPeople,
      };
    });
  };

  // Handle receipt updates
  const handleReceiptUpdate = (updatedReceipt: Receipt) => {
    setState((prevState) => {
      // Recalculate people totals with the updated receipt
      const updatedPeople = calculatePersonTotals(
        updatedReceipt,
        prevState.people,
        prevState.assignedItems
      );

      return {
        ...prevState,
        originalReceipt: updatedReceipt,
        people: updatedPeople,
      };
    });
  };

  // Handle item assignments
  const handleAssignItems = (
    itemIndex: number,
    assignments: PersonItemAssignment[]
  ) => {
    setState((prevState) => {
      if (!prevState.originalReceipt) return prevState;

      // Create new assignments map
      const newAssignedItems = new Map(prevState.assignedItems);

      // Update the assignments for this item
      if (assignments.length === 0) {
        newAssignedItems.delete(itemIndex);
      } else {
        newAssignedItems.set(itemIndex, assignments);
      }

      // Recalculate unassigned items
      const unassignedItems = getUnassignedItems(
        prevState.originalReceipt,
        newAssignedItems
      );

      // Recalculate people totals
      const updatedPeople = calculatePersonTotals(
        prevState.originalReceipt,
        prevState.people,
        newAssignedItems
      );

      return {
        ...prevState,
        assignedItems: newAssignedItems,
        unassignedItems,
        people: updatedPeople,
      };
    });
  };

  // Update loading state
  const setIsLoading = (isLoading: boolean) => {
    setState((prevState) => ({
      ...prevState,
      isLoading,
    }));
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
        return state.originalReceipt !== null;
      case "people":
        return state.people.length > 0;
      case "assign":
        return allItemsAssigned;
      default:
        return false;
    }
  };

  // Split all items evenly among all people
  const splitAllItemsEvenly = () => {
    if (!state.originalReceipt || state.people.length === 0) return;

    setState((prevState) => {
      if (!prevState.originalReceipt) return prevState;

      // Create new assignments map
      const newAssignedItems = new Map();

      // Calculate equal share percentage with 2 decimal places
      const equalShare = +(100 / prevState.people.length).toFixed(2);

      // For each item in the receipt
      prevState.originalReceipt.items.forEach((_, itemIndex) => {
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

        // Set the assignments for this item
        newAssignedItems.set(itemIndex, assignments);
      });

      // No unassigned items since all are assigned
      const unassignedItems: number[] = [];

      // Recalculate people totals
      const updatedPeople = calculatePersonTotals(
        prevState.originalReceipt,
        prevState.people,
        newAssignedItems
      );

      toast.success("All items split evenly among everyone!");

      return {
        ...prevState,
        assignedItems: newAssignedItems,
        unassignedItems,
        people: updatedPeople,
      };
    });

    // Don't automatically move to results tab anymore
    // setActiveTab("results");
  };

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
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="upload">Upload Receipt</TabsTrigger>
            <TabsTrigger value="people" disabled={!state.originalReceipt}>
              Add People
            </TabsTrigger>
            <TabsTrigger
              value="assign"
              disabled={!state.originalReceipt || state.people.length === 0}
            >
              Assign Items
            </TabsTrigger>
            <TabsTrigger
              value="results"
              disabled={!state.originalReceipt || state.people.length === 0}
            >
              Results
            </TabsTrigger>
          </TabsList>

          {state.originalReceipt && (
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
          />

          {state.originalReceipt && (
            <ReceiptDetails
              receipt={state.originalReceipt}
              onReceiptUpdate={handleReceiptUpdate}
            />
          )}
        </TabsContent>

        <TabsContent value="people" className="space-y-6">
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

          {state.originalReceipt && (
            <ReceiptDetails
              receipt={state.originalReceipt}
              onReceiptUpdate={handleReceiptUpdate}
            />
          )}
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          {state.originalReceipt && (
            <ItemAssignment
              receipt={state.originalReceipt}
              people={state.people}
              groups={state.groups}
              assignedItems={state.assignedItems}
              unassignedItems={state.unassignedItems}
              onAssignItems={handleAssignItems}
              onReceiptUpdate={handleReceiptUpdate}
            />
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <ResultsSummary
            people={state.people}
            receiptName={state.originalReceipt?.restaurant || null}
            receiptDate={state.originalReceipt?.date || null}
          />

          <PersonItems people={state.people} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center w-full mt-4">
        <KofiButton />
      </div>
    </main>
  );
}
