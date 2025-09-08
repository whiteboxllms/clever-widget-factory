import React, { useState, useLayoutEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandErrorBoundary,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface ParticipantSelectorProps {
  participants: string[];
  onParticipantsChange: (participants: string[]) => void;
  profiles: Profile[];
  assigneeId?: string | null;
}

export const ParticipantSelector: React.FC<ParticipantSelectorProps> = ({
  participants,
  onParticipantsChange,
  profiles,
  assigneeId
}) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Filter out the assignee from available participants
  const availableProfiles = profiles.filter(profile => profile.user_id !== assigneeId);
  
  // Get selected participant details
  const selectedParticipants = participants
    .map(participantId => profiles.find(p => p.user_id === participantId))
    .filter(Boolean);

  const handleSelect = (userId: string) => {
    if (participants.includes(userId)) {
      onParticipantsChange(participants.filter(id => id !== userId));
    } else {
      onParticipantsChange([...participants, userId]);
    }
  };

  const removeParticipant = (userId: string) => {
    onParticipantsChange(participants.filter(id => id !== userId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            Select participants...
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          {open && mounted && (
            <CommandErrorBoundary>
              <Command>
                <CommandInput placeholder="Search participants..." />
                <CommandList>
                  <CommandEmpty>No participants found.</CommandEmpty>
                  <CommandGroup>
                    {availableProfiles.map((profile) => (
                      <CommandItem
                        key={profile.user_id}
                        value={profile.full_name}
                        onSelect={() => handleSelect(profile.user_id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            participants.includes(profile.user_id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {profile.full_name}
                        <Badge variant="secondary" className="ml-auto">
                          {profile.role}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </CommandErrorBoundary>
          )}
        </PopoverContent>
      </Popover>
      
      {selectedParticipants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedParticipants.map((participant) => (
            <Badge key={participant.user_id} variant="secondary" className="pr-1">
              {participant.full_name}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => removeParticipant(participant.user_id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};