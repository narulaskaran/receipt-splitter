import { useState } from 'react';
import { PlusCircle, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Person } from '@/types';
import { toast } from 'sonner';

interface PeopleManagerProps {
  people: Person[];
  onPeopleChange: (people: Person[]) => void;
}

export function PeopleManager({ people, onPeopleChange }: PeopleManagerProps) {
  const [newPersonName, setNewPersonName] = useState('');

  const addPerson = () => {
    const trimmedName = newPersonName.trim();
    
    if (!trimmedName) {
      toast.error('Please enter a name');
      return;
    }
    
    if (people.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error('A person with that name already exists');
      return;
    }
    
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: trimmedName,
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    };
    
    onPeopleChange([...people, newPerson]);
    setNewPersonName('');
  };

  const removePerson = (id: string) => {
    onPeopleChange(people.filter(p => p.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPerson();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <User className="h-5 w-5" />
          People in Receipt
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add people who shared this receipt</p>
          ) : (
            people.map(person => (
              <div 
                key={person.id}
                className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full"
              >
                <span>{person.name}</span>
                <button
                  type="button"
                  onClick={() => removePerson(person.id)}
                  className="rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${person.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
        
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Add a person"
            value={newPersonName}
            onChange={e => setNewPersonName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow"
          />
          <Button 
            type="button" 
            variant="secondary"
            size="icon"
            onClick={addPerson}
            disabled={!newPersonName.trim()}
          >
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">Add person</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}