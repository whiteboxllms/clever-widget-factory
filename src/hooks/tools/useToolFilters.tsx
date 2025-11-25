import { useState, useMemo, useEffect } from 'react';
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

  useEffect(() => {
    console.log('=== MY CHECKED OUT FILTER TOGGLED ===');
    console.log('showMyCheckedOut:', showMyCheckedOut);
    console.log('currentUserId:', currentUserId);
    console.log('Total tools:', tools.length);
    console.log('Tools checked out:', tools.filter(t => t.is_checked_out).length);
    if (showMyCheckedOut) {
      const myCheckouts = tools.filter(t => t.is_checked_out && t.checked_out_user_id === currentUserId);
      console.log('My checked out tools:', myCheckouts.map(t => ({ name: t.name, checked_out_user_id: t.checked_out_user_id })));
    }
  }, [showMyCheckedOut, tools, currentUserId]);

  const filteredTools = useMemo(() => {
    if (showMyCheckedOut) {
      console.log('=== MY CHECKED OUT FILTER DEBUG ===');
      console.log('Current user ID:', currentUserId);
      console.log('Tools with checkouts:', tools.filter(t => t.is_checked_out).map(t => ({
        name: t.name,
        is_checked_out: t.is_checked_out,
        checked_out_user_id: t.checked_out_user_id,
        matches: t.checked_out_user_id === currentUserId
      })));
    }
    
    return tools.filter(tool => {
      // Search filter
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.storage_location?.toLowerCase().includes(searchTerm.toLowerCase());

      // My checked out filter - use embedded checkout data from tool object
      const matchesMyCheckedOut = !showMyCheckedOut || 
        (tool.is_checked_out && tool.checked_out_user_id === currentUserId);

      // Issues filter
      const matchesIssuesFilter = !showToolsWithIssues || 
        toolsWithIssues.has(tool.id);

      return matchesSearch && matchesMyCheckedOut && matchesIssuesFilter;
    });
  }, [tools, searchTerm, showMyCheckedOut, showToolsWithIssues, toolsWithIssues, currentUserId]);

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