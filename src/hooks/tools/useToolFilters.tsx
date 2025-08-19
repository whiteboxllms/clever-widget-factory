import { useState, useMemo } from 'react';
import { Tool } from './useToolsData';

export const useToolFilters = (tools: Tool[], toolsWithIssues: Set<string>) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showToolsWithIssues, setShowToolsWithIssues] = useState(false);

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      // Search filter
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());

      // Issues filter
      const matchesIssuesFilter = !showToolsWithIssues || 
        toolsWithIssues.has(tool.id) || 
        (tool.known_issues && tool.known_issues.trim().length > 0);

      return matchesSearch && matchesIssuesFilter;
    });
  }, [tools, searchTerm, showToolsWithIssues, toolsWithIssues]);

  return {
    searchTerm,
    setSearchTerm,
    showToolsWithIssues,
    setShowToolsWithIssues,
    filteredTools
  };
};