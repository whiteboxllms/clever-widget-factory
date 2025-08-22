import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToolsData } from "@/hooks/tools/useToolsData";
import { useToolFilters } from "@/hooks/tools/useToolFilters";
import { useToolHistory, HistoryEntry } from "@/hooks/tools/useToolHistory";
import { useToolsWithIssues } from "@/hooks/tools/useToolsWithIssues";
import { useToolIssues } from "@/hooks/useToolIssues";
import { toolsService } from "@/services/toolsService";
import { ToolFilters } from "../ToolFilters";
import { ToolGrid } from "../ToolGrid";
import { ToolDetails } from "../ToolDetails";
import { AddToolForm } from "../forms/AddToolForm";
import { EditToolForm } from "../forms/EditToolForm";
import { ToolCheckoutDialog } from "@/components/ToolCheckoutDialog";
import { ToolCheckInDialog } from "@/components/ToolCheckInDialog";
import { IssueResolutionDialog } from "@/components/IssueResolutionDialog";
import { IssueReportDialog } from "@/components/IssueReportDialog";
import { IssueEditDialog } from "@/components/IssueEditDialog";

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
  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [checkinTool, setCheckinTool] = useState(null);
  const [resolveIssue, setResolveIssue] = useState(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [reportIssueTool, setReportIssueTool] = useState(null);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [editIssue, setEditIssue] = useState(null);
  const [isEditIssueDialogOpen, setIsEditIssueDialogOpen] = useState(false);
  const [storageVicinities, setStorageVicinities] = useState([]);

  // Custom hooks
  const { tools, loading, activeCheckouts, fetchTools, createTool, updateTool } = useToolsData(showRemovedItems);
  const { toolsWithIssues, fetchToolsWithIssues } = useToolsWithIssues();
  const { filteredTools, searchTerm, setSearchTerm, showMyCheckedOut, setShowMyCheckedOut, showToolsWithIssues, setShowToolsWithIssues } = useToolFilters(tools, toolsWithIssues, activeCheckouts, user?.id || null);
  const { toolHistory, currentCheckout, fetchToolHistory } = useToolHistory();
  const { issues, fetchIssues, updateIssue } = useToolIssues(selectedTool?.id || null);

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

  const handleCheckinClick = (tool) => {
    setCheckinTool(tool);
    setIsCheckinDialogOpen(true);
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

  const handleEditIssue = (issue) => {
    setEditIssue(issue);
    setIsEditIssueDialogOpen(true);
  };

  const handleReportIssue = (tool) => {
    setReportIssueTool(tool);
    setIsReportIssueDialogOpen(true);
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
    return <div className="text-center py-8">Loading assets...</div>;
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
          onEditIssue={handleEditIssue}
        />
        
        <IssueResolutionDialog
          issue={resolveIssue}
          open={isResolveDialogOpen}
          onOpenChange={setIsResolveDialogOpen}
          onSuccess={() => {
            fetchIssues();
            fetchTools();
            // Refresh tool history to show issue resolution
            if (selectedTool) {
              fetchToolHistory(selectedTool.id);
            }
            setIsResolveDialogOpen(false);
            setResolveIssue(null);
          }}
        />

        <IssueEditDialog
          issue={editIssue}
          open={isEditIssueDialogOpen}
          onOpenChange={setIsEditIssueDialogOpen}
          onUpdate={updateIssue}
          onSuccess={() => {
            fetchIssues();
            fetchTools();
            // Refresh tool history to show issue updates
            if (selectedTool) {
              fetchToolHistory(selectedTool.id);
            }
            setIsEditIssueDialogOpen(false);
            setEditIssue(null);
          }}
        />
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
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
          <h1 className="text-2xl sm:text-3xl font-bold">Manage Assets <span className="text-sm text-muted-foreground">({tools.length})</span></h1>
        </div>

        <ToolFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showMyCheckedOut={showMyCheckedOut}
          onShowMyCheckedOutChange={setShowMyCheckedOut}
          showToolsWithIssues={showToolsWithIssues}
          onShowToolsWithIssuesChange={setShowToolsWithIssues}
          showRemovedItems={showRemovedItems}
          onShowRemovedItemsChange={setShowRemovedItems}
          actionButton={canEditTools && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => setIsAddDialogOpen(true)}
                  disabled={!searchTerm.trim()}
                  className="w-full sm:w-auto flex-shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Asset
                </Button>
              </TooltipTrigger>
              {!searchTerm.trim() && (
                <TooltipContent>
                  <p>Search for an asset first to avoid duplicates</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
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
              onCheckinClick={handleCheckinClick}
              onEditClick={handleEditClick}
              onRemoveClick={handleRemoveClick}
              onReportIssue={handleReportIssue}
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

      <ToolCheckInDialog
        tool={checkinTool}
        open={isCheckinDialogOpen}
        onOpenChange={setIsCheckinDialogOpen}
        onSuccess={() => {
          setIsCheckinDialogOpen(false);
          setCheckinTool(null);
          fetchTools();
        }}
      />

      <IssueReportDialog
        tool={reportIssueTool}
        open={isReportIssueDialogOpen}
        onOpenChange={setIsReportIssueDialogOpen}
        onSuccess={() => {
          fetchTools();
          fetchToolsWithIssues();
          // Refresh tool history to show new issue
          if (reportIssueTool) {
            fetchToolHistory(reportIssueTool.id);
          }
          setIsReportIssueDialogOpen(false);
          setReportIssueTool(null);
        }}
      />

      <IssueEditDialog
        issue={editIssue}
        open={isEditIssueDialogOpen}
        onOpenChange={setIsEditIssueDialogOpen}
        onUpdate={updateIssue}
        onSuccess={() => {
          fetchTools();
          fetchToolsWithIssues();
          // Refresh tool history to show issue updates
          if (selectedTool) {
            fetchToolHistory(selectedTool.id);
          }
          setIsEditIssueDialogOpen(false);
          setEditIssue(null);
        }}
      />
      </div>
    </TooltipProvider>
  );
};