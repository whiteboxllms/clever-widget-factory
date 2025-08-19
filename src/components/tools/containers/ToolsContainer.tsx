import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToolsData } from "@/hooks/tools/useToolsData";
import { useToolFilters } from "@/hooks/tools/useToolFilters";
import { useToolHistory } from "@/hooks/tools/useToolHistory";
import { useToolsWithIssues } from "@/hooks/tools/useToolsWithIssues";
import { useToolIssues } from "@/hooks/useToolIssues";
import { toolsService } from "@/services/toolsService";
import { ToolFilters } from "../ToolFilters";
import { ToolGrid } from "../ToolGrid";
import { ToolDetails } from "../ToolDetails";
import { AddToolForm } from "../forms/AddToolForm";
import { EditToolForm } from "../forms/EditToolForm";
import { ToolCheckoutDialog } from "@/components/ToolCheckoutDialog";
import { IssueResolutionDialog } from "@/components/IssueResolutionDialog";

export const ToolsContainer = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const { canEditTools } = useAuth();
  
  // State management
  const [selectedTool, setSelectedTool] = useState(null);
  const [showRemovedItems, setShowRemovedItems] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTool, setEditTool] = useState(null);
  const [checkoutTool, setCheckoutTool] = useState(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [resolveIssue, setResolveIssue] = useState(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [storageVicinities, setStorageVicinities] = useState([]);

  // Custom hooks
  const { tools, loading, activeCheckouts, fetchTools, createTool, updateTool } = useToolsData(showRemovedItems);
  const { toolsWithIssues, fetchToolsWithIssues } = useToolsWithIssues();
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
      fetchToolsWithIssues();
    }
  }, [showToolsWithIssues]);

  // Handle editing from URL parameter
  useEffect(() => {
    if (toolId && tools.length > 0) {
      const toolToEdit = tools.find(tool => tool.id === toolId);
      if (toolToEdit) {
        setEditTool(toolToEdit);
        setIsEditDialogOpen(true);
      }
    }
  }, [toolId, tools]);

  // Auto-migrate issues when tool is selected
  useEffect(() => {
    if (selectedTool) {
      toolsService.migrateCheckinIssuesToToolIssues(selectedTool.id, fetchIssues);
    }
  }, [selectedTool]);

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
    setEditTool(tool);
    setIsEditDialogOpen(true);
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

  const handleUpdateTool = async (toolId: string, updates: any) => {
    await updateTool(toolId, updates);
    await fetchTools();
  };

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
          open={isResolveDialogOpen}
          onOpenChange={setIsResolveDialogOpen}
          onSuccess={() => {
            fetchIssues();
            fetchTools();
            setIsResolveDialogOpen(false);
            setResolveIssue(null);
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

      <EditToolForm
        tool={editTool}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditTool(null);
          navigate('/tools');
        }}
        onSubmit={handleUpdateTool}
        storageVicinities={storageVicinities}
      />

      <ToolCheckoutDialog
        tool={checkoutTool}
        open={isCheckoutDialogOpen}
        onOpenChange={setIsCheckoutDialogOpen}
        onSuccess={() => {
          fetchTools();
          setIsCheckoutDialogOpen(false);
          setCheckoutTool(null);
        }}
      />
    </div>
  );
};