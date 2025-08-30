import { useState, useMemo } from 'react';
import { Tool } from './useToolsData';

export const useToolFilters = (
  tools: Tool[], 
  toolsWithIssues: Set<string>, 
  activeCheckouts: any, 
  currentUserId: string | null
) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showMyCheckedOut, setShowMyCheckedOut] = useState(false);
  const [showToolsWithIssues, setShowToolsWithIssues] = useState(false);

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      // Search filter
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.storage_location?.toLowerCase().includes(searchTerm.toLowerCase());

      // My checked out filter
      const matchesMyCheckedOut = !showMyCheckedOut || 
        (activeCheckouts[tool.id] && activeCheckouts[tool.id]?.user_id === currentUserId);

      // Issues filter
      const matchesIssuesFilter = !showToolsWithIssues || 
        toolsWithIssues.has(tool.id);

      return matchesSearch && matchesMyCheckedOut && matchesIssuesFilter;
    });
  }, [tools, searchTerm, showMyCheckedOut, showToolsWithIssues, toolsWithIssues, activeCheckouts, currentUserId]);

  return {
    searchTerm,
    setSearchTerm,
    showMyCheckedOut,
    setShowMyCheckedOut,
    showToolsWithIssues,
    setShowToolsWithIssues,
    filteredTools
  };
};