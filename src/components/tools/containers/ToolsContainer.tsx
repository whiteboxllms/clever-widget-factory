import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ArrowLeft } from "lucide-react";
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
  const { user, canEditTools, isLeadership } = useAuth();
  
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
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Manage Tools</h1>
          </div>
          {canEditTools && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => setIsAddDialogOpen(true)}
                  disabled={!searchTerm.trim()}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tool
                </Button>
              </TooltipTrigger>
              {!searchTerm.trim() && (
                <TooltipContent>
                  <p>Search for a tool first to avoid duplicates</p>
                </TooltipContent>
              )}
            </Tooltip>
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
              isLeadership={isLeadership}
              currentUserId={user?.id}
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
        initialName={searchTerm}
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
    </TooltipProvider>
  );
};