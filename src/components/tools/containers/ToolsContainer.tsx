import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToolsData } from "@/hooks/tools/useToolsData";
import { useToolFilters } from "@/hooks/tools/useToolFilters";
import { useToolHistory } from "@/hooks/tools/useToolHistory";
import { useToolIssues } from "@/hooks/useToolIssues";
import { toolsService } from "@/services/toolsService";
import { ToolFilters } from "../ToolFilters";
import { ToolGrid } from "../ToolGrid";
import { ToolDetails } from "../ToolDetails";
import { AddToolForm } from "../forms/AddToolForm";
import { ToolCheckoutDialog } from "@/components/ToolCheckoutDialog";
import { IssueResolutionDialog } from "@/components/IssueResolutionDialog";

export const ToolsContainer = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const { canEditTools } = useAuth();
  
  // State management
  const [selectedTool, setSelectedTool] = useState(null);
  const [showRemovedItems, setShowRemovedItems] = useState(false);
  const [toolsWithIssues, setToolsWithIssues] = useState(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [checkoutTool, setCheckoutTool] = useState(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [resolveIssue, setResolveIssue] = useState(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [storageVicinities, setStorageVicinities] = useState([]);

  // Custom hooks
  const { tools, loading, activeCheckouts, fetchTools, createTool } = useToolsData(showRemovedItems);
  const { filteredTools, searchTerm, setSearchTerm, showToolsWithIssues, setShowToolsWithIssues } = useToolFilters(tools, toolsWithIssues);
  const { toolHistory, currentCheckout, fetchToolHistory } = useToolHistory();
  const { issues, fetchIssues } = useToolIssues(selectedTool?.id || null);

  // Fetch storage vicinities for form
  useEffect(() => {
    const fetchStorageVicinities = async () => {
      try {
        const { data } = await supabase
          .from('storage_vicinities')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        setStorageVicinities(data || []);
      } catch (error) {
        console.error('Error fetching storage vicinities:', error);
      }
    };
    fetchStorageVicinities();
  }, []);

  // Fetch tools with issues when filter is enabled
  useEffect(() => {
    if (showToolsWithIssues) {
      const fetchIssuesData = async () => {
        const issuesSet = await toolsService.fetchToolsWithIssues();
        setToolsWithIssues(issuesSet);
      };
      fetchIssuesData();
    }
  }, [showToolsWithIssues]);

  // Handle editing from URL parameter
  useEffect(() => {
    if (toolId && tools.length > 0) {
      const toolToEdit = tools.find(tool => tool.id === toolId);
      if (toolToEdit) {
        handleToolClick(toolToEdit);
      }
    }
  }, [toolId, tools]);

  const handleToolClick = (tool) => {
    setSelectedTool(tool);
    fetchToolHistory(tool.id);
  };

  const handleBackToTools = () => {
    setSelectedTool(null);
    navigate('/tools');
  };

  const handleCheckoutClick = (tool) => {
    setCheckoutTool(tool);
    setIsCheckoutDialogOpen(true);
  };

  const handleEditClick = (tool) => {
    navigate(`/tools/${tool.id}`);
  };

  const handleRemoveClick = (tool) => {
    // TODO: Implement remove dialog
    console.log('Remove tool:', tool);
  };

  const handleResolveIssue = (issue) => {
    setResolveIssue(issue);
    setIsResolveDialogOpen(true);
  };

  const handleAddTool = async (toolData) => {
    await createTool(toolData);
    await fetchTools();
  };

  // Auto-migrate issues when tool is selected
  useEffect(() => {
    if (selectedTool) {
      toolsService.migrateCheckinIssuesToToolIssues(selectedTool.id, fetchIssues);
    }
  }, [selectedTool]);

  if (loading) {
    return <div className="text-center py-8">Loading tools...</div>;
  }

  if (selectedTool) {
    return (
      <>
        <ToolDetails
          tool={selectedTool}
          toolHistory={toolHistory}
          currentCheckout={currentCheckout}
          issues={issues}
          onBack={handleBackToTools}
          onResolveIssue={handleResolveIssue}
        />
        
        <IssueResolutionDialog
          issue={resolveIssue}
          isOpen={isResolveDialogOpen}
          onClose={() => {
            setIsResolveDialogOpen(false);
            setResolveIssue(null);
          }}
          onResolved={() => {
            fetchIssues();
            fetchTools();
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Tools</h1>
        {canEditTools && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        )}
      </div>

      <ToolFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        showToolsWithIssues={showToolsWithIssues}
        onShowToolsWithIssuesChange={setShowToolsWithIssues}
        showRemovedItems={showRemovedItems}
        onShowRemovedItemsChange={setShowRemovedItems}
      />

      <ToolGrid
        tools={filteredTools}
        activeCheckouts={activeCheckouts}
        toolsWithIssues={toolsWithIssues}
        canEditTools={canEditTools}
        onToolClick={handleToolClick}
        onCheckoutClick={handleCheckoutClick}
        onEditClick={handleEditClick}
        onRemoveClick={handleRemoveClick}
      />

      <AddToolForm
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleAddTool}
        storageVicinities={storageVicinities}
      />

      <ToolCheckoutDialog
        tool={checkoutTool}
        isOpen={isCheckoutDialogOpen}
        onClose={() => {
          setIsCheckoutDialogOpen(false);
          setCheckoutTool(null);
        }}
        onCheckoutComplete={() => {
          fetchTools();
          setIsCheckoutDialogOpen(false);
          setCheckoutTool(null);
        }}
      />
    </div>
  );
};