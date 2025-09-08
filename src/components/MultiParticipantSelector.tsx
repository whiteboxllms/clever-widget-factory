import * as React from "react"
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
} from "@/components/ui/multi-select"

interface Profile {
  id: string
  user_id: string
  full_name: string
  role: string
}

interface MultiParticipantSelectorProps {
  participants: string[]
  onParticipantsChange: (participants: string[]) => void
  profiles: Profile[]
  assigneeId?: string | null
}

export function MultiParticipantSelector({
  participants,
  onParticipantsChange,
  profiles,
  assigneeId
}: MultiParticipantSelectorProps) {
  const [search, setSearch] = React.useState("")
  const [open, setOpen] = React.useState(false)

  // Filter out the assignee from available participants
  const availableProfiles = profiles.filter(profile => 
    profile.user_id !== assigneeId
  )

  // Filter profiles based on search
  const filteredProfiles = availableProfiles.filter(profile =>
    profile.full_name.toLowerCase().includes(search.toLowerCase()) ||
    profile.role.toLowerCase().includes(search.toLowerCase())
  )

  // Get selected participant details for display
  const selectedParticipants = participants
    .map(userId => profiles.find(p => p.user_id === userId))
    .filter(Boolean)
    .map(profile => ({
      id: profile!.user_id,
      label: profile!.full_name
    }))

  const handleSelect = (userId: string) => {
    const newParticipants = participants.includes(userId)
      ? participants.filter(id => id !== userId)
      : [...participants, userId]
    
    onParticipantsChange(newParticipants)
  }

  const handleRemove = (userId: string) => {
    onParticipantsChange(participants.filter(id => id !== userId))
  }

  return (
    <MultiSelect open={open} onOpenChange={setOpen}>
      <MultiSelectTrigger
        selectedItems={selectedParticipants}
        placeholder="Select participants..."
        onRemoveItem={handleRemove}
      />
      <MultiSelectContent
        searchable
        searchPlaceholder="Search participants..."
        onSearchChange={setSearch}
      >
        {filteredProfiles.length === 0 ? (
          <div className="py-2 px-3 text-sm text-muted-foreground">
            No participants found
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <MultiSelectItem
              key={profile.user_id}
              value={profile.user_id}
              checked={participants.includes(profile.user_id)}
              onSelect={() => handleSelect(profile.user_id)}
            >
              <div className="flex items-center justify-between w-full">
                <span>{profile.full_name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {profile.role}
                </span>
              </div>
            </MultiSelectItem>
          ))
        )}
      </MultiSelectContent>
    </MultiSelect>
  )
}