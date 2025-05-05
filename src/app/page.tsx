'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

import { ReceiptUploader } from '@/components/receipt-uploader';
import { PeopleManager } from '@/components/people-manager';
import { ItemAssignment } from '@/components/item-assignment';
import { ReceiptDetails } from '@/components/receipt-details';
import { ResultsSummary } from '@/components/results-summary';
import { PersonItems } from '@/components/person-items';

import { 
  type Receipt, 
  type Person, 
  type PersonItemAssignment, 
  type ReceiptState
} from '@/types';
import { 
  calculatePersonTotals, 
  validateItemAssignments,
  getUnassignedItems
} from '@/lib/receipt-utils';

export default function Home() {
  // Receipt state
  const [state, setState] = useState<ReceiptState>({
    originalReceipt: null,
    people: [],
    assignedItems: new Map(),
    unassignedItems: [],
    isLoading: false,
    error: null,
  });
  
  // Current tab
  const [activeTab, setActiveTab] = useState('upload');
  
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
      unassignedItems: Array.from({ length: receipt.items.length }, (_, i) => i),
      isLoading: false,
      error: null,
    });
    
    setActiveTab('people');
    toast.success('Receipt successfully parsed!');
  };
  
  // Handle people changes
  const handlePeopleChange = (updatedPeople: Person[]) => {
    setState(prevState => {
      // If we're removing a person, we need to update the assigned items
      if (prevState.people.length > updatedPeople.length) {
        const removedPeople = prevState.people.filter(
          p => !updatedPeople.some(up => up.id === p.id)
        );
        
        const newAssignedItems = new Map(prevState.assignedItems);
        
        // Remove the assignments for the removed people
        removedPeople.forEach(person => {
          newAssignedItems.forEach((assignments, itemIndex) => {
            const updatedAssignments = assignments.filter(
              a => a.personId !== person.id
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
    setState(prevState => {
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
  const handleAssignItems = (itemIndex: number, assignments: PersonItemAssignment[]) => {
    setState(prevState => {
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
    setState(prevState => ({
      ...prevState,
      isLoading,
    }));
  };
  
  // Effect to auto-switch to results tab once all items are assigned
  useEffect(() => {
    if (allItemsAssigned && activeTab === 'assign') {
      // Don't switch automatically if we just got to the assign tab
      // Give a short delay so user can see the assignment is complete
      const timer = setTimeout(() => {
        setActiveTab('results');
        toast.success('All items assigned!');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [allItemsAssigned, activeTab]);
  
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Receipt Splitter</h1>
      <p className="text-muted-foreground mb-6">
        Upload a receipt, add people, and easily split items
      </p>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-2">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="upload">
              Upload Receipt
            </TabsTrigger>
            <TabsTrigger 
              value="people" 
              disabled={!state.originalReceipt}
            >
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
            <div className="flex items-center gap-2 w-full sm:w-48">
              <Progress value={calculateProgress()} className="w-full" />
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
              assignedItems={state.assignedItems}
              unassignedItems={state.unassignedItems}
              onAssignItems={handleAssignItems}
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
    </main>
  );
}