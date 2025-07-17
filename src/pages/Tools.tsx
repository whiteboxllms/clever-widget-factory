import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Wrench, AlertTriangle, CheckCircle, Clock, User, Calendar, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  condition: string;
  status: string;
  image_url?: string;
  intended_storage_location: string;
  actual_location?: string;
  serial_number?: string;
  last_maintenance?: string;
  purchase_date?: string;
  manual_url?: string;
  created_at: string;
  updated_at: string;
}

interface NewToolForm {
  name: string;
  description: string;
  category: string;
  condition: string;
  status: string;
  intended_storage_location: string;
  serial_number: string;
  manual_url: string;
  image_file: File | null;
}

interface CheckoutHistory {
  id: string;
  checkout_date: string;
  expected_return_date?: string;
  user_name: string;
  intended_usage?: string;
  notes?: string;
  is_returned: boolean;
  checkin?: {
    id: string;
    checkin_date: string;
    condition_after: string;
    problems_reported?: string;
    notes?: string;
    returned_to_correct_location: boolean;
  };
}

const getStatusVariant = (status: string, condition: string) => {
  if (condition === 'broken' || status === 'maintenance') return 'destructive';
  if (status === 'checked_out') return 'secondary';
  if (condition === 'excellent' || condition === 'good') return 'default';
  return 'outline';
};

const getStatusLabel = (status: string, condition: string) => {
  if (condition === 'broken') return 'Broken';
  if (status === 'maintenance') return 'Needs Maintenance';
  if (status === 'checked_out') return 'Checked Out';
  return 'Operational';
};

const getConditionIcon = (status: string, condition: string) => {
  if (condition === 'broken') return AlertTriangle;
  if (status === 'maintenance') return Clock;
  return CheckCircle;
};

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolHistory, setToolHistory] = useState<CheckoutHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newTool, setNewTool] = useState<NewToolForm>({
    name: "",
    description: "",
    category: "",
    condition: "good",
    status: "available",
    intended_storage_location: "",
    serial_number: "",
    manual_url: "",
    image_file: null
  });
  const { toast } = useToast();

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

  const fetchToolHistory = async (toolId: string) => {
    try {
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          checkins!inner(
            id,
            checkin_date,
            condition_after,
            problems_reported,
            notes,
            returned_to_correct_location
          )
        `)
        .eq('tool_id', toolId)
        .order('checkout_date', { ascending: false });

      if (error) throw error;
      setToolHistory(data || []);
    } catch (error) {
      console.error('Error fetching tool history:', error);
      toast({
        title: "Error",
        description: "Failed to load tool history",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToolClick = (tool: Tool) => {
    setSelectedTool(tool);
    fetchToolHistory(tool.id);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewTool(prev => ({ ...prev, image_file: file }));
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('tool-images')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('tool-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmitNewTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = null;
      if (newTool.image_file) {
        imageUrl = await uploadImage(newTool.image_file);
      }

      const { error } = await supabase
        .from('tools')
        .insert({
          name: newTool.name,
          description: newTool.description || null,
          category: newTool.category || null,
          condition: newTool.condition as any,
          status: newTool.status as any,
          intended_storage_location: newTool.intended_storage_location,
          serial_number: newTool.serial_number || null,
          image_url: imageUrl,
          manual_url: newTool.manual_url || null
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tool added successfully"
      });

      // Reset form and close dialog
      setNewTool({
        name: "",
        description: "",
        category: "",
        condition: "good",
        status: "available",
        intended_storage_location: "",
        serial_number: "",
        manual_url: "",
        image_file: null
      });
      setImagePreview(null);
      setIsAddDialogOpen(false);
      
      // Refresh tools list
      await fetchTools();

    } catch (error) {
      console.error('Error adding tool:', error);
      toast({
        title: "Error",
        description: "Failed to add tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setNewTool({
      name: "",
      description: "",
      category: "",
      condition: "good",
      status: "available",
      intended_storage_location: "",
      serial_number: "",
      manual_url: "",
      image_file: null
    });
    setImagePreview(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading tools...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Manage Tools</h1>
            <p className="text-muted-foreground">View and manage all your tools and equipment</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetAddForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Tool
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Tool</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmitNewTool} className="space-y-6">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label htmlFor="image">Tool Image</Label>
                  <div className="flex items-center gap-4">
                    {imagePreview ? (
                      <div className="relative w-24 h-24">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => {
                            setImagePreview(null);
                            setNewTool(prev => ({ ...prev, image_file: null }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload an image of the tool (optional)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tool Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Tool Name *</Label>
                  <Input
                    id="name"
                    value={newTool.name}
                    onChange={(e) => setNewTool(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter tool name"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTool.description}
                    onChange={(e) => setNewTool(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter tool description, specifications, or notes"
                    rows={3}
                  />
                </div>

                {/* Category and Condition */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={newTool.category}
                      onChange={(e) => setNewTool(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g., Power Tools, Hand Tools"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select 
                      value={newTool.condition} 
                      onValueChange={(value) => setNewTool(prev => ({ ...prev, condition: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="broken">Broken</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status and Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={newTool.status} 
                      onValueChange={(value) => setNewTool(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="checked_out">Checked Out</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="broken">Broken</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Storage Location *</Label>
                    <Input
                      id="location"
                      value={newTool.intended_storage_location}
                      onChange={(e) => setNewTool(prev => ({ ...prev, intended_storage_location: e.target.value }))}
                      placeholder="e.g., Shelf A-3, Toolbox #2"
                      required
                    />
                  </div>
                </div>

                {/* Serial Number and Manual URL */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serial">Serial Number</Label>
                    <Input
                      id="serial"
                      value={newTool.serial_number}
                      onChange={(e) => setNewTool(prev => ({ ...prev, serial_number: e.target.value }))}
                      placeholder="Enter serial number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual">Manual URL</Label>
                    <Input
                      id="manual"
                      type="url"
                      value={newTool.manual_url}
                      onChange={(e) => setNewTool(prev => ({ ...prev, manual_url: e.target.value }))}
                      placeholder="https://example.com/manual.pdf"
                    />
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !newTool.name || !newTool.intended_storage_location}>
                    {isSubmitting ? "Adding..." : "Add Tool"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools by name, category, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool) => {
            const StatusIcon = getConditionIcon(tool.status, tool.condition);
            return (
              <Dialog key={tool.id}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
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
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(tool.status, tool.condition)}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {getStatusLabel(tool.status, tool.condition)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {tool.category && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Category: {tool.category}
                        </p>
                      )}
                      {tool.description && (
                        <p className="text-sm line-clamp-2">{tool.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Location: {tool.actual_location || tool.intended_storage_location}
                      </p>
                    </CardContent>
                  </Card>
                </DialogTrigger>

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onClick={() => handleToolClick(tool)}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                        {tool.image_url ? (
                          <img
                            src={tool.image_url}
                            alt={tool.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Wrench className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl">{tool.name}</h2>
                        <Badge variant={getStatusVariant(tool.status, tool.condition)}>
                          {getStatusLabel(tool.status, tool.condition)}
                        </Badge>
                      </div>
                    </DialogTitle>
                  </DialogHeader>

                  <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                      <TabsTrigger value="issues">Known Issues</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Basic Information</h4>
                          <div className="space-y-2 text-sm">
                            <div><strong>Category:</strong> {tool.category || 'Not specified'}</div>
                            <div><strong>Serial Number:</strong> {tool.serial_number || 'Not specified'}</div>
                            <div><strong>Condition:</strong> {tool.condition}</div>
                            <div><strong>Status:</strong> {tool.status}</div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Location & Maintenance</h4>
                          <div className="space-y-2 text-sm">
                            <div><strong>Intended Location:</strong> {tool.intended_storage_location}</div>
                            <div><strong>Current Location:</strong> {tool.actual_location || 'Same as intended'}</div>
                            <div><strong>Last Maintenance:</strong> {tool.last_maintenance || 'Not recorded'}</div>
                            <div><strong>Purchase Date:</strong> {tool.purchase_date || 'Not recorded'}</div>
                          </div>
                        </div>
                      </div>
                      {tool.description && (
                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">General Notes</h4>
                        <p className="text-sm text-muted-foreground">
                          No general notes recorded for this tool yet.
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="issues" className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Known Issues</h4>
                        <p className="text-sm text-muted-foreground">
                          No known issues reported for this tool yet.
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-4">Check Out/Check In History</h4>
                        {toolHistory.length > 0 ? (
                          <div className="space-y-4">
                            {toolHistory.map((checkout) => (
                              <Card key={checkout.id} className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span className="font-medium">{checkout.user_name}</span>
                                  </div>
                                  <Badge variant={checkout.is_returned ? "default" : "secondary"}>
                                    {checkout.is_returned ? "Returned" : "Checked Out"}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      Checked out: {new Date(checkout.checkout_date).toLocaleDateString()}
                                    </div>
                                    {checkout.intended_usage && (
                                      <div className="mt-1">
                                        <strong>Usage:</strong> {checkout.intended_usage}
                                      </div>
                                    )}
                                    {checkout.notes && (
                                      <div className="mt-1">
                                        <strong>Checkout Notes:</strong> {checkout.notes}
                                      </div>
                                    )}
                                  </div>
                                  {checkout.checkin && (
                                    <div>
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        Checked in: {new Date(checkout.checkin.checkin_date).toLocaleDateString()}
                                      </div>
                                      <div className="mt-1">
                                        <strong>Condition:</strong> {checkout.checkin.condition_after}
                                      </div>
                                      {checkout.checkin.problems_reported && (
                                        <div className="mt-1 text-destructive">
                                          <strong>Issues:</strong> {checkout.checkin.problems_reported}
                                        </div>
                                      )}
                                      {checkout.checkin.notes && (
                                        <div className="mt-1">
                                          <strong>Checkin Notes:</strong> {checkout.checkin.notes}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No checkout history recorded for this tool yet.
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <Wrench className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tools found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search terms" : "Add your first tool to get started"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}