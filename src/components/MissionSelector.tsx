import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, X, Flag, Check } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { missionsQueryKey } from '@/lib/queryKeys';

interface Mission {
  id: string;
  title: string;
  mission_number: number;
  status: string;
}

interface MissionSelectorProps {
  selectedMissionId: string | null | undefined;
  onMissionChange: (missionId: string | null) => void;
  disabled?: boolean;
}

export function MissionSelector({ selectedMissionId, onMissionChange, disabled = false }: MissionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  // Fetch all missions - use shared query key for cache sharing
  // Always enabled to use cache, but will use cached data if available
  const { data: missions = [], isLoading } = useQuery({
    queryKey: missionsQueryKey(),
    queryFn: async () => {
      const result = await apiService.get('/missions');
      return result.data || [];
    },
    ...offlineQueryConfig,
  });

  // Load selected mission details when selectedMissionId changes
  useEffect(() => {
    if (selectedMissionId && missions.length > 0) {
      const mission = missions.find((m: Mission) => m.id === selectedMissionId);
      setSelectedMission(mission || null);
    } else {
      setSelectedMission(null);
    }
  }, [selectedMissionId, missions]);

  // Filter missions based on search term and exclude completed/cancelled projects
  // (but include the selected mission even if completed/cancelled, so users can see what's linked)
  const filteredMissions = missions.filter((mission: Mission) => {
    // Always include the selected mission even if completed/cancelled
    if (selectedMissionId === mission.id) return true;
    
    // Exclude completed and cancelled projects
    if (mission.status === 'completed' || mission.status === 'cancelled') return false;
    
    // Filter by search term if provided
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      mission.title.toLowerCase().includes(searchLower) ||
      mission.mission_number.toString().includes(searchLower)
    );
  });

  const handleSelectMission = (mission: Mission) => {
    setSelectedMission(mission);
    onMissionChange(mission.id);
    setShowSearch(false);
    setSearchTerm("");
  };

  const handleClearMission = () => {
    setSelectedMission(null);
    onMissionChange(null);
    setSearchTerm("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Flag className="h-4 w-4" />
        Project / Mission
      </label>
      
      {selectedMission ? (
        <div className="flex items-center gap-2 min-w-0">
          <Card className="flex-1 p-3 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Badge variant="outline" className="font-mono flex-shrink-0">
                  #{selectedMission.mission_number}
                </Badge>
                <span className="font-medium truncate min-w-0">{selectedMission.title}</span>
                <Badge variant={selectedMission.status === 'completed' ? 'default' : 'secondary'} className="flex-shrink-0">
                  {selectedMission.status}
                </Badge>
              </div>
            </div>
          </Card>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClearMission}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {!showSearch ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSearch(true)}
              disabled={disabled}
              className="w-full justify-start"
            >
              <Search className="h-4 w-4 mr-2" />
              Search for a project...
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects by title or number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchTerm("");
                  }}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {isLoading ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">
                  Loading projects...
                </Card>
              ) : filteredMissions.length === 0 ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">
                  {searchTerm ? "No projects found matching your search" : "No projects available"}
                </Card>
              ) : (
                <Card className="max-h-60 overflow-y-auto">
                  <div className="divide-y">
                    {filteredMissions.slice(0, 50).map((mission: Mission) => (
                      <button
                        key={mission.id}
                        type="button"
                        onClick={() => handleSelectMission(mission)}
                        className="w-full p-3 text-left hover:bg-accent transition-colors flex items-center justify-between gap-2 min-w-0"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="font-mono flex-shrink-0">
                            #{mission.mission_number}
                          </Badge>
                          <span className="font-medium truncate min-w-0">{mission.title}</span>
                          <Badge 
                            variant={mission.status === 'completed' ? 'default' : 'secondary'}
                            className="flex-shrink-0"
                          >
                            {mission.status}
                          </Badge>
                        </div>
                        {selectedMissionId === mission.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

