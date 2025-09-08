import { useState, useLayoutEffect } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandErrorBoundary } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationId } from '@/hooks/useOrganizationId';

interface StorageVicinity {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
}

interface StorageVicinitySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function StorageVicinitySelector({ value, onValueChange, placeholder = "Select storage vicinity..." }: StorageVicinitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [vicinities, setVicinities] = useState<StorageVicinity[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newVicinity, setNewVicinity] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const organizationId = useOrganizationId();

  const fetchVicinities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('storage_vicinities')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVicinities(data || []);
    } catch (error) {
      console.error('Error fetching storage vicinities:', error);
      toast({
        title: "Error",
        description: "Failed to load storage vicinities",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    setMounted(true);
    fetchVicinities();
  }, []);

  const handleAddVicinity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newVicinity.name.trim()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('storage_vicinities')
        .insert({
          name: newVicinity.name.trim(),
          description: newVicinity.description.trim() || null,
          created_by: user.id,
          organization_id: organizationId
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Storage vicinity added successfully"
      });

      setVicinities(prev => [...prev, data]);
      onValueChange(data.name);
      setNewVicinity({ name: '', description: '' });
      setIsAddDialogOpen(false);
      setOpen(false);
    } catch (error: any) {
      console.error('Error adding storage vicinity:', error);
      toast({
        title: "Error",
        description: error.message?.includes('duplicate') 
          ? "A vicinity with this name already exists"
          : "Failed to add storage vicinity",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVicinity = vicinities.find(vicinity => vicinity.name === value);
  console.log('StorageVicinitySelector Debug:', { value, vicinities, selectedVicinity });

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between"
          >
            {selectedVicinity ? selectedVicinity.name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          {open && mounted && (
            <CommandErrorBoundary>
              <Command>
                <CommandInput placeholder="Search vicinities..." />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2 text-center">
                      <p className="text-sm text-muted-foreground mb-2">No vicinity found.</p>
                      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add New Vicinity
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {vicinities.map((vicinity) => (
                      <CommandItem
                        key={vicinity.id}
                        value={vicinity.name}
                        onSelect={() => {
                          onValueChange(vicinity.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === vicinity.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{vicinity.name}</div>
                          {vicinity.description && (
                            <div className="text-sm text-muted-foreground">{vicinity.description}</div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {vicinities.length > 0 && (
                    <CommandGroup>
                      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                          <CommandItem onSelect={() => setIsAddDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add New Vicinity
                          </CommandItem>
                        </DialogTrigger>
                      </Dialog>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </CommandErrorBoundary>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Storage Vicinity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddVicinity} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vicinity-name">Vicinity Name *</Label>
              <Input
                id="vicinity-name"
                value={newVicinity.name}
                onChange={(e) => {
                  const value = e.target.value;
                  // Capitalize first letter of each word as user types
                  const capitalizedValue = value
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                  setNewVicinity(prev => ({ ...prev, name: capitalizedValue }));
                }}
                placeholder="e.g., Workshop, Garage, Storage Room"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="vicinity-description">Description (Optional)</Label>
              <Textarea
                id="vicinity-description"
                value={newVicinity.description}
                onChange={(e) => setNewVicinity(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details about this storage area..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewVicinity({ name: '', description: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !newVicinity.name.trim()}
              >
                {isSubmitting ? "Adding..." : "Add Vicinity"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}