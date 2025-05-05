import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import { type Receipt, type Person, type PersonItemAssignment } from '@/types';
import { formatCurrency } from '@/lib/receipt-utils';

interface ItemAssignmentProps {
  receipt: Receipt;
  people: Person[];
  assignedItems: Map<number, PersonItemAssignment[]>;
  unassignedItems: number[];
  onAssignItems: (itemIndex: number, assignments: PersonItemAssignment[]) => void;
}

export function ItemAssignment({
  receipt,
  people,
  assignedItems,
  unassignedItems,
  onAssignItems,
}: ItemAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Map<string, number>>(new Map());

  // Open the assignment dialog for a specific item
  const openAssignmentDialog = (itemIndex: number) => {
    // Get current assignments for this item
    const currentAssignments = assignedItems.get(itemIndex) || [];
    
    // Build assignments map for the form
    const newAssignments = new Map<string, number>();
    
    // Initialize with existing assignments
    currentAssignments.forEach((assignment) => {
      newAssignments.set(assignment.personId, assignment.sharePercentage);
    });
    
    // If there are no assignments yet, set default values
    if (currentAssignments.length === 0 && people.length === 1) {
      // If only one person, assign 100% to them
      newAssignments.set(people[0].id, 100);
    }
    
    setAssignments(newAssignments);
    setCurrentItemIndex(itemIndex);
    setOpen(true);
  };

  // Handle split equally between selected people
  const splitEqually = () => {
    if (!currentItemIndex) return;

    // Get selected people (those with any value assigned)
    const selectedPeopleIds = Array.from(assignments.keys());
    
    if (selectedPeopleIds.length === 0) {
      toast.error('Please select at least one person');
      return;
    }
    
    // Calculate equal share
    const equalShare = Math.floor(100 / selectedPeopleIds.length);
    
    // Distribute shares equally
    const newAssignments = new Map<string, number>();
    
    // Assign equal shares
    selectedPeopleIds.forEach((personId, index) => {
      // Last person gets the remainder to ensure total is exactly 100%
      if (index === selectedPeopleIds.length - 1) {
        const remainder = 100 - (equalShare * (selectedPeopleIds.length - 1));
        newAssignments.set(personId, remainder);
      } else {
        newAssignments.set(personId, equalShare);
      }
    });
    
    setAssignments(newAssignments);
  };

  // Save the assignment
  const saveAssignment = () => {
    if (currentItemIndex === null) return;
    
    // Calculate total percentage
    const totalPercentage = Array.from(assignments.values()).reduce(
      (sum, value) => sum + (value || 0), 
      0
    );
    
    // Ensure total is 100%
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error('Total percentage must be 100%');
      return;
    }
    
    // Convert to assignment array
    const assignmentArray: PersonItemAssignment[] = [];
    
    assignments.forEach((percentage, personId) => {
      if (percentage > 0) {
        assignmentArray.push({
          personId,
          sharePercentage: percentage,
        });
      }
    });
    
    // Call the parent handler
    onAssignItems(currentItemIndex, assignmentArray);
    
    // Close dialog
    setOpen(false);
    setCurrentItemIndex(null);
  };

  // Get person name by ID
  const getPersonName = (personId: string): string => {
    return people.find(p => p.id === personId)?.name || 'Unknown';
  };

  // Create a readable assignment summary
  const getAssignmentSummary = (itemIndex: number): string => {
    const itemAssignments = assignedItems.get(itemIndex) || [];
    
    if (itemAssignments.length === 0) {
      return 'Unassigned';
    }
    
    if (itemAssignments.length === 1 && itemAssignments[0].sharePercentage === 100) {
      return getPersonName(itemAssignments[0].personId);
    }
    
    return itemAssignments
      .map(a => `${getPersonName(a.personId)} (${a.sharePercentage}%)`)
      .join(', ');
  };

  // Check if an item is fully assigned (100%)
  const isItemFullyAssigned = (itemIndex: number): boolean => {
    const itemAssignments = assignedItems.get(itemIndex) || [];
    const totalPercentage = itemAssignments.reduce(
      (sum, a) => sum + a.sharePercentage, 
      0
    );
    return Math.abs(totalPercentage - 100) < 0.01;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Assign Items</CardTitle>
      </CardHeader>
      
      <CardContent>
        {people.length === 0 ? (
          <p className="text-muted-foreground">Add people first to assign items</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Assigned To</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.items.map((item, index) => (
                <TableRow key={index} className={unassignedItems.includes(index) ? 'bg-destructive/5' : ''}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {item.quantity > 1 && (
                      <div className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.price * (item.quantity || 1))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isItemFullyAssigned(index) ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={unassignedItems.includes(index) ? 'text-destructive' : ''}>
                        {getAssignmentSummary(index)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAssignmentDialog(index)}
                    >
                      Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Assign Item: {currentItemIndex !== null ? receipt.items[currentItemIndex]?.name : ''}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Item Price:</span>
                <span>
                  {currentItemIndex !== null 
                    ? formatCurrency(
                        receipt.items[currentItemIndex]?.price * 
                        (receipt.items[currentItemIndex]?.quantity || 1)
                      ) 
                    : ''}
                </span>
              </div>
              
              {people.map(person => (
                <div key={person.id} className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor={`person-${person.id}`}>{person.name}</Label>
                  <div className="flex items-center">
                    <Input
                      id={`person-${person.id}`}
                      type="number"
                      min="0"
                      max="100"
                      value={assignments.get(person.id) || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        const newAssignments = new Map(assignments);
                        newAssignments.set(person.id, value);
                        setAssignments(newAssignments);
                      }}
                      className="w-20 text-right"
                    />
                    <span className="ml-2">%</span>
                  </div>
                </div>
              ))}
              
              <div className="flex items-center justify-between pt-2">
                <span className="font-medium">Total:</span>
                <span className={
                  Math.abs(
                    Array.from(assignments.values()).reduce((sum, val) => sum + (val || 0), 0) - 100
                  ) > 0.01 
                    ? 'text-destructive font-medium' 
                    : 'text-green-500 font-medium'
                }>
                  {Array.from(assignments.values()).reduce((sum, val) => sum + (val || 0), 0)}%
                </span>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={splitEqually}
                className="w-full sm:w-auto"
              >
                Split Equally
              </Button>
              <Button 
                type="button" 
                onClick={saveAssignment}
                className="w-full sm:w-auto"
                disabled={Math.abs(
                  Array.from(assignments.values()).reduce((sum, val) => sum + (val || 0), 0) - 100
                ) > 0.01}
              >
                Save Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}