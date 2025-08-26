import { useState, useMemo } from 'react';
import { Tool } from './useToolsData';

export const useToolFilters = (
  tools: Tool[], 
  toolsWithIssues: Set<string>, 
  toolsWithUnassignedIssues: Set<string>,
  activeCheckouts: any, 
  currentUserId: string | null
) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showMyCheckedOut, setShowMyCheckedOut] = useState(false);
  const [showToolsWithIssues, setShowToolsWithIssues] = useState(false);
  const [showToolkeeperActionNeeded, setShowToolkeeperActionNeeded] = useState(false);

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      // Search filter
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.storage_vicinity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.storage_location?.toLowerCase().includes(searchTerm.toLowerCase());

      // Debug logging
      if (searchTerm.toLowerCase() === 's1p2') {
        console.log('Debug tool:', tool.name, 'storage_location:', tool.storage_location, 'matches:', matchesSearch);
      }

      // My checked out filter
      const matchesMyCheckedOut = !showMyCheckedOut || 
        (activeCheckouts[tool.id] && activeCheckouts[tool.id]?.user_id === currentUserId);

      // Issues filter
      const matchesIssuesFilter = !showToolsWithIssues || 
        toolsWithIssues.has(tool.id);

      // Toolkeeper action needed filter
      const matchesToolkeeperFilter = !showToolkeeperActionNeeded || 
        toolsWithUnassignedIssues.has(tool.id);

      return matchesSearch && matchesMyCheckedOut && matchesIssuesFilter && matchesToolkeeperFilter;
    });
  }, [tools, searchTerm, showMyCheckedOut, showToolsWithIssues, showToolkeeperActionNeeded, toolsWithIssues, toolsWithUnassignedIssues, activeCheckouts, currentUserId]);

  return {
    searchTerm,
    setSearchTerm,
    showMyCheckedOut,
    setShowMyCheckedOut,
    showToolsWithIssues,
    setShowToolsWithIssues,
    showToolkeeperActionNeeded,
    setShowToolkeeperActionNeeded,
    filteredTools
  };
};