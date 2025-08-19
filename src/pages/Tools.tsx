import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Wrench, AlertTriangle, CheckCircle, ArrowLeft, Edit, ClipboardCheck, LogIn } from "lucide-react";
import { ToolCheckoutDialog } from "@/components/ToolCheckoutDialog";
import { ToolCheckInDialog } from "@/components/ToolCheckInDialog";
import { Tables } from "@/integrations/supabase/types";

type Tool = Tables<'tools'>;

const getStatusVariant = (status: string) => {
  if (status === 'unavailable' || status === 'unable_to_find') return 'destructive';
  if (status === 'checked_out') return 'secondary';
  return 'default';
};

const getStatusLabel = (status: string) => {
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'unable_to_find') return 'Unable to Find';
  if (status === 'checked_out') return 'Checked Out';
  return 'Available';
};

const ToolDetailView = ({ tool, onBack }: { tool: Tool; onBack: () => void }) => {
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <main className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Tools
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{tool.name}</CardTitle>
                {tool.category && (
                  <Badge variant="outline" className="w-fit">
                    {tool.category}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="aspect-square w-full mb-6 bg-muted rounded-lg overflow-hidden">
                  {tool.image_url ? (
                    <img
                      src={tool.image_url}
                      alt={tool.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Wrench className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {tool.description && (
                  <div className="mb-4">
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground">{tool.description}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge variant={getStatusVariant(tool.status)}>
                      {getStatusLabel(tool.status)}
                    </Badge>
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium">Location:</span>
                    <span className="text-muted-foreground">
                      {tool.storage_vicinity}
                      {tool.storage_location && ` - ${tool.storage_location}`}
                    </span>
                  </div>

                  {tool.serial_number && (
                    <div className="flex justify-between">
                      <span className="font-medium">Serial Number:</span>
                      <span className="text-muted-foreground">{tool.serial_number}</span>
                    </div>
                  )}
                </div>

                {tool.known_issues && (
                  <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <h3 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Known Issues
                    </h3>
                    <p className="text-orange-700">{tool.known_issues}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tool.status === 'available' && (
                  <Button 
                    onClick={() => setShowCheckoutDialog(true)}
                    className="w-full flex items-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Check Out Tool
                  </Button>
                )}

                {tool.status === 'checked_out' && (
                  <Button 
                    onClick={() => setShowCheckinDialog(true)}
                    className="w-full flex items-center gap-2"
                    variant="secondary"
                  >
                    <LogIn className="h-4 w-4 rotate-180" />
                    Check In Tool
                  </Button>
                )}

                <Button 
                  onClick={() => navigate(`/audit-tool/${tool.id}`)}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Audit Tool
                </Button>

                <Button 
                  onClick={() => navigate(`/tools/${tool.id}/edit`)}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Tool
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {showCheckoutDialog && (
        <ToolCheckoutDialog
          tool={tool}
          open={showCheckoutDialog}
          onOpenChange={setShowCheckoutDialog}
          onSuccess={() => {
            setShowCheckoutDialog(false);
            // Refresh tool data would go here
          }}
        />
      )}

      {showCheckinDialog && (
        <ToolCheckInDialog
          tool={tool}
          open={showCheckinDialog}
          onOpenChange={setShowCheckinDialog}
          onSuccess={() => {
            setShowCheckinDialog(false);
            // Refresh tool data would go here
          }}
        />
      )}
    </div>
  );
};

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { canEditTools } = useAuth();
  const { toolId } = useParams();
  const navigate = useNavigate();

  const fetchTools = async () => {
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .order('name');

      if (error) throw error;
      setTools(data || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast({
        title: "Error",
        description: "Failed to load tools",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTool = toolId ? tools.find(t => t.id === toolId) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Wrench className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading tools...</p>
        </div>
      </div>
    );
  }

  // Show detail view if toolId is present and tool is found
  if (toolId && selectedTool) {
    return (
      <ToolDetailView 
        tool={selectedTool} 
        onBack={() => navigate('/tools')}
      />
    );
  }

  // Show tool not found if toolId is present but tool is not found
  if (toolId && !selectedTool) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Tool Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested tool could not be found.</p>
          <Button onClick={() => navigate('/tools')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tools
          </Button>
        </div>
      </div>
    );
  }

  // Show list view
  return (
    <div className="min-h-screen bg-background">
      <main className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Tools</h1>
            <p className="text-muted-foreground">Manage tools and track their usage</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool) => (
            <Card 
              key={tool.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/tools/${tool.id}`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg mb-3 text-center">{tool.name}</CardTitle>
                <div className="aspect-square w-full mb-3 bg-muted rounded-lg overflow-hidden">
                  {tool.image_url ? (
                    <img
                      src={tool.image_url}
                      alt={tool.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Wrench className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {tool.description && (
                  <p className="text-sm line-clamp-2 mb-3">{tool.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  {tool.serial_number && (
                    <p className="text-sm text-muted-foreground">
                      Serial: {tool.serial_number}
                    </p>
                  )}
                  <Badge variant={getStatusVariant(tool.status)}>
                    {getStatusLabel(tool.status)}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">
                  Location: {tool.storage_vicinity}
                  {tool.storage_location && ` - ${tool.storage_location}`}
                </p>
                
                {tool.known_issues && (
                  <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                    <strong>Known Issues:</strong> {tool.known_issues}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}