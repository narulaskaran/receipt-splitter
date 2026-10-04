import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Person } from '@/types';
import { toast } from 'sonner';

interface PeopleManagerProps {
  people: Person[];
  onPeopleChange: (people: Person[]) => void;
}

export function PeopleManager({ people, onPeopleChange }: PeopleManagerProps) {
  const [newPersonName, setNewPersonName] = useState('');

  const addPerson = () => {
    // Accept a comma-separated list so a whole table can be added at once.
    const names = newPersonName
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      toast.error('Please enter a name');
      return;
    }

    const taken = new Set(people.map(p => p.name.toLowerCase()));
    const added: Person[] = [];
    const duplicates: string[] = [];
    for (const name of names) {
      if (taken.has(name.toLowerCase())) {
        duplicates.push(name);
        continue;
      }
      taken.add(name.toLowerCase());
      added.push({
        id: crypto.randomUUID(),
        name,
        items: [],
        totalBeforeTax: 0,
        tax: 0,
        tip: 0,
        finalTotal: 0,
      });
    }

    if (duplicates.length > 0) {
      toast.error(
        duplicates.length === 1
          ? 'A person with that name already exists'
          : `Already added: ${duplicates.join(', ')}`
      );
    }
    if (added.length === 0) return;

    onPeopleChange([...people, ...added]);
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
    <section aria-labelledby="people-heading" className="flex flex-col gap-3 p-4 sm:p-5">
      <h3 id="people-heading" className="text-sm font-medium">
        People
      </h3>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Add names, e.g. Ana, Ben"
          aria-label="Name"
          value={newPersonName}
          onChange={e => setNewPersonName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[44px] flex-grow"
          autoComplete="off"
        />
        <Button
          type="button"
          onClick={addPerson}
          disabled={!newPersonName.trim()}
          aria-label="Add person"
        >
          <Plus />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one yet. Add yourself too if you&apos;re paying a share.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {people.map(person => (
            <li
              key={person.id}
              className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-secondary-foreground"
            >
              <span className="text-sm font-medium">{person.name}</span>
              <button
                type="button"
                onClick={() => removePerson(person.id)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${person.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
