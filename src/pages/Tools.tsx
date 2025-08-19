import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Wrench, AlertTriangle, CheckCircle } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  image_url?: string;
  storage_vicinity: string;
  storage_location: string | null;
  serial_number?: string;
  known_issues?: string;
}

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

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { canEditTools } = useAuth();

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
            <Card key={tool.id} className="cursor-pointer hover:shadow-lg transition-shadow">
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