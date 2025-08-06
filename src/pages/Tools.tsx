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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Wrench, AlertTriangle, CheckCircle, Clock, User, Calendar, Upload, X, LogOut, Edit, ArrowLeft, Trash2 } from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/imageUtils";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToolCheckoutDialog } from "@/components/ToolCheckoutDialog";

import { useNavigate, useParams } from "react-router-dom";

interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  condition: string;
  status: string;
  image_url?: string;
  storage_vicinity: string;
  storage_location: string | null;
  actual_location?: string;
  serial_number?: string;
  last_maintenance?: string;
  
  manual_url?: string;
  known_issues?: string;
  stargazer_sop?: string;
  created_at: string;
  updated_at: string;
}

interface NewToolForm {
  name: string;
  description: string;
  category: string;
  condition: string;
  status: string;
  storage_vicinity: string;
  storage_location: string | null;
  serial_number: string;
  image_file: File | null;
}

interface CheckoutHistory {
  id: string;
  type?: string;
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
    user_name?: string;
    hours_used?: number;
    location_found?: string;
    after_image_urls?: string[];
  };
}

const getStatusVariant = (status: string, condition: string) => {
  if (condition === 'not_functional' || status === 'unavailable' || status === 'unable_to_find') return 'destructive';
  if (status === 'checked_out') return 'secondary';
  if (condition === 'good') return 'default';
  return 'outline';
};

const getStatusLabel = (status: string, condition: string) => {
  if (condition === 'not_functional') return 'Not Functional';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'unable_to_find') return 'Unable to Find';
  if (status === 'checked_out') return 'Checked Out';
  return 'Available';
};

const getConditionIcon = (status: string, condition: string) => {
  if (condition === 'not_functional' || status === 'unable_to_find') return AlertTriangle;
  if (status === 'unavailable') return Clock;
  return CheckCircle;
};

export default function Tools() {
  const { toolId } = useParams();
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolHistory, setToolHistory] = useState<CheckoutHistory[]>([]);
  const [currentCheckout, setCurrentCheckout] = useState<{user_name: string} | null>(null);
  const [activeCheckouts, setActiveCheckouts] = useState<{[key: string]: {user_name: string}}>({});
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [checkoutTool, setCheckoutTool] = useState<Tool | null>(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [newTool, setNewTool] = useState<NewToolForm>({
    name: "",
    description: "",
    category: "",
        condition: "good",
    status: "available",
    storage_vicinity: "",
    storage_location: "",
    serial_number: "",
    image_file: null
  });
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const { isAdmin, canEditTools } = useAuth();
  const [editTool, setEditTool] = useState<Tool | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [toolToRemove, setToolToRemove] = useState<Tool | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeComment, setRemoveComment] = useState("");
  const [removeImageFiles, setRemoveImageFiles] = useState<File[]>([]);
  const [removeImagePreviews, setRemoveImagePreviews] = useState<string[]>([]);
  const [showRemovedItems, setShowRemovedItems] = useState(false);
  const navigate = useNavigate();

  const fetchTools = async () => {
    try {
      let query = supabase
        .from('tools')
        .select('*');
      
      if (!showRemovedItems) {
        query = query.neq('status', 'unable_to_find');
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      setTools(data || []);

      // Fetch active checkouts for all tools
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select('tool_id, user_name')
        .eq('is_returned', false);

      if (checkoutsError) {
        console.error('Error fetching active checkouts:', checkoutsError);
      } else {
        const checkoutMap: {[key: string]: {user_name: string}} = {};
        checkoutsData?.forEach(checkout => {
          checkoutMap[checkout.tool_id] = { user_name: checkout.user_name };
        });
        setActiveCheckouts(checkoutMap);
      }
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
      // Fetch all checkouts (both returned and not returned)
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select(`
          *,
          checkins(
            id,
            checkin_date,
            condition_after,
            problems_reported,
            notes,
            returned_to_correct_location,
            user_name,
            hours_used,
            location_found,
            after_image_urls
          )
        `)
        .eq('tool_id', toolId)
        .order('checkout_date', { ascending: false });

      if (checkoutsError) throw checkoutsError;

      // Fetch standalone check-ins (not linked to any checkout)
      const { data: standaloneCheckins, error: checkinsError } = await supabase
        .from('checkins')
        .select('*')
        .eq('tool_id', toolId)
        .is('checkout_id', null)
        .order('checkin_date', { ascending: false });

      if (checkinsError) throw checkinsError;
      
      console.log('Checkouts data:', checkoutsData);
      console.log('Standalone checkins:', standaloneCheckins);
      
      // Find current checkout (not returned)
      const activeCheckout = checkoutsData?.find(checkout => !checkout.is_returned);
      setCurrentCheckout(activeCheckout ? { user_name: activeCheckout.user_name } : null);
      
      // Combine checkouts and standalone check-ins into history
      const processedCheckouts = (checkoutsData || []).map(checkout => ({
        ...checkout,
        checkin: checkout.checkins && checkout.checkins.length > 0 ? checkout.checkins[0] : null
      }));
      
      const allHistory = [
        ...processedCheckouts,
        ...(standaloneCheckins || []).map(checkin => ({
          id: checkin.id,
          type: 'checkin',
          checkout_date: checkin.checkin_date,
          user_name: checkin.user_name,
          is_returned: true,
          checkin: checkin
        }))
      ].sort((a, b) => new Date(b.checkout_date).getTime() - new Date(a.checkout_date).getTime());
      
      console.log('Processed history:', allHistory);
      setToolHistory(allHistory);
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

  useEffect(() => {
    fetchTools();
  }, [showRemovedItems]);

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

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToolClick = (tool: Tool) => {
    setSelectedTool(tool);
    fetchToolHistory(tool.id);
    setCurrentCheckout(null); // Reset current checkout state
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
    try {
      // Enhanced compression with detailed tracking
      const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

      const compressionResult = await compressImageDetailed(
        file,
        {},
        enhancedToast.showCompressionProgress
      );
      
      enhancedToast.dismiss(compressionToast.id);
      const compressionCompleteToast = enhancedToast.showCompressionComplete(compressionResult);
      
      const compressedFile = compressionResult.file;
      const fileName = `${Date.now()}-${compressedFile.name}`;
      
      // Enhanced upload tracking
      enhancedToast.dismiss(compressionCompleteToast.id);
      const uploadToast = enhancedToast.showUploadStart(fileName, compressedFile.size);

      const { data, error } = await supabase.storage
        .from('tool-images')
        .upload(fileName, compressedFile);

      if (error) {
        enhancedToast.dismiss(uploadToast.id);
        // Extract status code from Supabase error
        const statusCode = error && typeof error === 'object' && 'status' in error ? error.status as number : undefined;
        enhancedToast.showUploadError(error.message, file.name, statusCode);
        return null;
      }

      enhancedToast.dismiss(uploadToast.id);
      
      const { data: urlData } = supabase.storage
        .from('tool-images')
        .getPublicUrl(fileName);

      enhancedToast.showUploadSuccess(fileName, urlData.publicUrl);
      return urlData.publicUrl;
      
    } catch (error) {
      enhancedToast.showCompressionError(error.message, file.name);
      return null;
    }
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
          storage_vicinity: newTool.storage_vicinity,
          storage_location: newTool.storage_location || null,
          serial_number: newTool.serial_number || null,
          image_url: imageUrl
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
        storage_vicinity: "",
        storage_location: "",
        serial_number: "",
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
      storage_vicinity: "",
      storage_location: "",
      serial_number: "",
      image_file: null
    });
    setImagePreview(null);
  };

  const handleEditTool = (tool: Tool) => {
    setEditTool(tool);
    setIsEditDialogOpen(true);
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editTool) {
      setEditImageUploading(true);
      try {
        const imageUrl = await uploadImage(file);
        if (imageUrl) {
          setEditTool(prev => prev ? { ...prev, image_url: imageUrl } : null);
        }
      } catch (error) {
        console.error('Error uploading image:', error);
      } finally {
        setEditImageUploading(false);
      }
    }
  };

  const handleUpdateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTool) return;

    setIsSubmitting(true);

    try {
      // Contributors and admins can edit all fields
      const updateData = {
        name: editTool.name,
        description: editTool.description || null,
        category: editTool.category || null,
        condition: editTool.condition as any,
        status: editTool.status as any,
        storage_vicinity: editTool.storage_vicinity,
        storage_location: editTool.storage_location || null,
        serial_number: editTool.serial_number || null,
        image_url: editTool.image_url || null,
      };

      const { error } = await supabase
        .from('tools')
        .update(updateData)
        .eq('id', editTool.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tool updated successfully"
      });

      setIsEditDialogOpen(false);
      setEditTool(null);
      await fetchTools();

      // If we came from the audit page, navigate back
      if (toolId) {
        navigate(`/audit/tool/${toolId}`);
      }

    } catch (error) {
      console.error('Error updating tool:', error);
      toast({
        title: "Error",
        description: "Failed to update tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setRemoveImageFiles(prev => [...prev, ...files]);
      
      // Generate previews
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          setRemoveImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeRemovalImage = (index: number) => {
    setRemoveImageFiles(prev => prev.filter((_, i) => i !== index));
    setRemoveImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadRemovalImages = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      try {
        const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);
        const compressionResult = await compressImageDetailed(
          file,
          {},
          enhancedToast.showCompressionProgress
        );
        
        enhancedToast.dismiss(compressionToast.id);
        const compressionCompleteToast = enhancedToast.showCompressionComplete(compressionResult);
        
        const compressedFile = compressionResult.file;
        const fileName = `removal-${Date.now()}-${compressedFile.name}`;
        
        enhancedToast.dismiss(compressionCompleteToast.id);
        const uploadToast = enhancedToast.showUploadStart(fileName, compressedFile.size);

        const { data, error } = await supabase.storage
          .from('tool-images')
          .upload(fileName, compressedFile);

        if (error) {
          enhancedToast.dismiss(uploadToast.id);
          const statusCode = error && typeof error === 'object' && 'status' in error ? error.status as number : undefined;
          enhancedToast.showUploadError(error.message, file.name, statusCode);
          return null;
        }

        enhancedToast.dismiss(uploadToast.id);
        
        const { data: urlData } = supabase.storage
          .from('tool-images')
          .getPublicUrl(fileName);

        enhancedToast.showUploadSuccess(fileName, urlData.publicUrl);
        return urlData.publicUrl;
        
      } catch (error) {
        enhancedToast.showCompressionError(error.message, file.name);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(url => url !== null) as string[];
  };

  const handleRemoveTool = async () => {
    if (!toolToRemove) return;

    setIsSubmitting(true);

    try {
      // Upload images if any
      const imageUrls = await uploadRemovalImages(removeImageFiles);
      
      // Prepare the removal details
      const removalDetails = {
        reason: removeReason,
        comment: removeComment,
        images: imageUrls,
        removed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tools')
        .update({
          status: 'unable_to_find',
          known_issues: `Tool removed: ${removeReason}${removeComment ? ` - ${removeComment}` : ''}${imageUrls.length > 0 ? ` (${imageUrls.length} image(s) attached)` : ''}`
        })
        .eq('id', toolToRemove.id);

      if (error) throw error;

      toast({
        title: "Tool Removed",
        description: `${toolToRemove.name} has been marked as removed`
      });

      // Reset form
      setIsRemoveDialogOpen(false);
      setToolToRemove(null);
      setRemoveReason("");
      setRemoveComment("");
      setRemoveImageFiles([]);
      setRemoveImagePreviews([]);
      await fetchTools();

    } catch (error) {
      console.error('Error removing tool:', error);
      toast({
        title: "Error",
        description: "Failed to remove tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading tools...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manage Tools</h1>
            <p className="text-muted-foreground">View and manage all your tools and equipment</p>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search tools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-removed"
                    checked={showRemovedItems}
                    onCheckedChange={setShowRemovedItems}
                  />
                  <Label htmlFor="show-removed" className="text-sm text-muted-foreground">
                    Show removed items
                  </Label>
                </div>
              )}
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
                      <Select value={newTool.category} onValueChange={(value) => setNewTool(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Electric Tool">Electric Tool</SelectItem>
                          <SelectItem value="Vehicle">Vehicle</SelectItem>
                          <SelectItem value="Combustion Engine">Combustion Engine</SelectItem>
                          <SelectItem value="Hand Tools">Hand Tools</SelectItem>
                          <SelectItem value="Recreation">Recreation</SelectItem>
                        </SelectContent>
                      </Select>
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
                           <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="functional_but_not_efficient">Functional but not as efficient as it could be</SelectItem>
                            <SelectItem value="not_functional">Not functional</SelectItem>
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
                           <SelectItem value="unavailable">Unavailable</SelectItem>
                         </SelectContent>
                      </Select>
                    </div>
                     <div className="space-y-2">
                       <Label htmlFor="storage_vicinity">Storage Vicinity *</Label>
                       <Select value={newTool.storage_vicinity} onValueChange={(value) => setNewTool(prev => ({ ...prev, storage_vicinity: value }))}>
                         <SelectTrigger>
                           <SelectValue placeholder="Select storage vicinity..." />
                         </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Composter Area">Composter Area</SelectItem>
                            <SelectItem value="Guest House">Guest House</SelectItem>
                            <SelectItem value="Storage Shed">Storage Shed</SelectItem>
                            <SelectItem value="ATI Learning Site">ATI Learning Site</SelectItem>
                            <SelectItem value="ATI Accomodations">ATI Accomodations</SelectItem>
                            <SelectItem value="ATI CR">ATI CR</SelectItem>
                            <SelectItem value="Lanai">Lanai</SelectItem>
                          </SelectContent>
                       </Select>
                     </div>
                    <div className="space-y-2">
                      <Label htmlFor="storage_location">Storage Location</Label>
                      <Input
                        id="storage_location"
                        value={newTool.storage_location}
                        onChange={(e) => setNewTool(prev => ({ ...prev, storage_location: e.target.value }))}
                        placeholder="e.g., Shelf A-3, Toolbox #2"
                      />
                    </div>
                  </div>

                  {/* Serial Number */}
                  <div className="space-y-2">
                    <Label htmlFor="serial">Serial Number *</Label>
                    <Input
                      id="serial"
                      value={newTool.serial_number}
                      onChange={(e) => setNewTool(prev => ({ ...prev, serial_number: e.target.value }))}
                      placeholder="Enter serial number"
                      required
                    />
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
                     <Button type="submit" disabled={isSubmitting || !newTool.name || !newTool.storage_vicinity || !newTool.serial_number}>
                       {isSubmitting ? "Adding..." : "Add Tool"}
                     </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool) => {
            const StatusIcon = getConditionIcon(tool.status, tool.condition);
            return (
              <Dialog key={tool.id}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow">
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
                      {/* Serial and Status on same line */}
                      <div className="flex items-center justify-between mb-2">
                        {tool.serial_number && (
                          <p className="text-sm text-muted-foreground">
                            Serial: {tool.serial_number}
                          </p>
                        )}
                        <Badge variant={getStatusVariant(tool.status, tool.condition)}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {getStatusLabel(tool.status, tool.condition)}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        Location: {tool.actual_location || (tool.storage_vicinity + (tool.storage_location ? ` - ${tool.storage_location}` : ''))}
                      </p>
                      
                      {/* Action Buttons */}
                      <div className="space-y-2">
                        {activeCheckouts[tool.id] && (
                          <Button
                            size="sm"
                            className="w-full"
                            disabled
                            variant="secondary"
                          >
                            <User className="mr-2 h-3 w-3" />
                            Checked out by {activeCheckouts[tool.id].user_name}
                          </Button>
                        )}
                        
                        {/* Checkout, Edit and Remove on same line */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCheckoutTool(tool);
                              setIsCheckoutDialogOpen(true);
                            }}
                            disabled={!!activeCheckouts[tool.id] || tool.status !== 'available' || tool.condition === 'not_functional'}
                          >
                            <LogOut className="mr-2 h-3 w-3" />
                            Checkout
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTool(tool);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-2 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setToolToRemove(tool);
                              setIsRemoveDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
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
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(tool.status, tool.condition)}>
                            {getStatusLabel(tool.status, tool.condition)}
                          </Badge>
                          {tool.status === 'checked_out' && currentCheckout && (
                            <span className="text-sm text-muted-foreground">
                              by {currentCheckout.user_name}
                            </span>
                          )}
                        </div>
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
                            <div><strong>Intended Location:</strong> {tool.storage_vicinity}{tool.storage_location ? ` - ${tool.storage_location}` : ''}</div>
                            <div><strong>Current Location:</strong> {tool.actual_location || 'Same as intended'}</div>
                            <div><strong>Last Maintenance:</strong> {tool.last_maintenance || 'Not recorded'}</div>
                            
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
                        {tool.known_issues ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-amber-800">
                                <p className="whitespace-pre-wrap">{tool.known_issues}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No known issues reported for this tool yet.
                          </p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-4">Usage History</h4>
                        {toolHistory.length > 0 ? (
                          <div className="space-y-3">
                            {toolHistory.map((checkout) => (
                              <div key={checkout.id} className="space-y-2">
                                {checkout.type === 'checkin' ? (
                                  /* Standalone Check-in Event */
                                  <Card className="p-3 bg-green-50 border-green-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="font-medium text-green-900">Tool Check-in</span>
                                      </div>
                                      <div className="text-sm text-green-700">
                                        {new Date(checkout.checkout_date).toLocaleDateString()} at {new Date(checkout.checkout_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                    <div className="text-sm space-y-1">
                                      <div><strong>User:</strong> {checkout.user_name}</div>
                                      <div><strong>Condition after use:</strong> 
                                        <Badge variant={checkout.checkin?.condition_after === 'not_functional' ? 'destructive' : 'default'} className="ml-2">
                                          {checkout.checkin?.condition_after}
                                        </Badge>
                                      </div>
                                      <div><strong>Returned to correct location:</strong> {checkout.checkin?.returned_to_correct_location ? 'Yes' : 'No'}</div>
                                      {checkout.checkin?.hours_used && (
                                        <div><strong>Hours used:</strong> {checkout.checkin.hours_used}</div>
                                      )}
                                      {checkout.checkin?.location_found && (
                                        <div><strong>Found at:</strong> {checkout.checkin.location_found}</div>
                                      )}
                                      {checkout.checkin?.problems_reported && (
                                        <div className="text-destructive"><strong>Issues reported:</strong> {checkout.checkin.problems_reported}</div>
                                      )}
                                      {checkout.checkin?.notes && (
                                        <div><strong>Notes:</strong> {checkout.checkin.notes}</div>
                                      )}
                                    </div>
                                  </Card>
                                ) : (
                                  <>
                                    {/* Checkout Event */}
                                    <Card className="p-3 bg-blue-50 border-blue-200">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <LogOut className="h-4 w-4 text-blue-600" />
                                          <span className="font-medium text-blue-900">Tool Checked Out</span>
                                        </div>
                                        <div className="text-sm text-blue-700">
                                          {new Date(checkout.checkout_date).toLocaleDateString()} at {new Date(checkout.checkout_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      </div>
                                      <div className="text-sm space-y-1">
                                        <div><strong>User:</strong> {checkout.user_name}</div>
                                        {checkout.intended_usage && (
                                          <div><strong>Purpose:</strong> {checkout.intended_usage}</div>
                                        )}
                                        {checkout.expected_return_date && (
                                          <div><strong>Expected Return:</strong> {new Date(checkout.expected_return_date).toLocaleDateString()}</div>
                                        )}
                                        {checkout.notes && (
                                          <div><strong>Notes:</strong> {checkout.notes}</div>
                                        )}
                                      </div>
                                    </Card>

                                    {/* Checkin Event (if returned) */}
                                    {checkout.checkin && (
                                      <Card className="p-3 bg-green-50 border-green-200 ml-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span className="font-medium text-green-900">Tool Checked In</span>
                                          </div>
                                          <div className="text-sm text-green-700">
                                            {new Date(checkout.checkin.checkin_date).toLocaleDateString()} at {new Date(checkout.checkin.checkin_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        </div>
                                         <div className="text-sm space-y-1">
                                           <div><strong>Returned by:</strong> {checkout.checkin.user_name || checkout.user_name}</div>
                                           <div><strong>Condition after use:</strong> 
                                             <Badge variant={checkout.checkin.condition_after === 'not_functional' ? 'destructive' : 'default'} className="ml-2">
                                               {checkout.checkin.condition_after}
                                             </Badge>
                                           </div>
                                           <div><strong>Returned to correct location:</strong> {checkout.checkin.returned_to_correct_location ? 'Yes' : 'No'}</div>
                                           {checkout.checkin.hours_used && (
                                             <div><strong>Hours used:</strong> {checkout.checkin.hours_used}</div>
                                           )}
                                           {checkout.checkin.location_found && (
                                             <div><strong>Found at:</strong> {checkout.checkin.location_found}</div>
                                           )}
                                           {checkout.checkin.problems_reported && (
                                             <div className="text-destructive"><strong>Issues reported:</strong> {checkout.checkin.problems_reported}</div>
                                           )}
                                           {checkout.checkin.notes && (
                                             <div><strong>Return notes:</strong> {checkout.checkin.notes}</div>
                                           )}
                                         </div>
                                      </Card>
                                    )}

                                    {/* Currently Checked Out Indicator */}
                                    {!checkout.is_returned && (
                                      <Card className="p-3 bg-yellow-50 border-yellow-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-yellow-600" />
                                          <span className="font-medium text-yellow-900">Currently Checked Out</span>
                                          <Badge variant="secondary">Active</Badge>
                                        </div>
                                      </Card>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No usage history recorded for this tool yet.
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

        {/* Checkout Dialog */}
        <ToolCheckoutDialog
          tool={checkoutTool}
          open={isCheckoutDialogOpen}
          onOpenChange={setIsCheckoutDialogOpen}
          onSuccess={fetchTools}
        />

        {/* Edit Tool Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Tool</DialogTitle>
            </DialogHeader>
            
            {editTool && (
              <form onSubmit={handleUpdateTool} className="space-y-6">
                {/* Tool Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Tool Name *</Label>
                  <Input
                    id="edit-name"
                    value={editTool.name}
                    onChange={(e) => setEditTool(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter tool name"
                    required
                  />
                </div>

                {/* Image Upload Section */}
                <div className="space-y-2">
                  <Label>Tool Image</Label>
                  <div className="flex items-start gap-4">
                    {editTool.image_url ? (
                      <img 
                        src={editTool.image_url} 
                        alt="Current tool image" 
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-muted rounded-lg border flex items-center justify-center">
                        <Wrench className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                      />
                      {editImageUploading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          Uploading image...
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Upload an image of the tool (optional)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editTool.description || ''}
                    onChange={(e) => setEditTool(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Enter tool description, specifications, or notes"
                    rows={3}
                  />
                </div>

                {/* Category and Condition */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select value={editTool.category || ''} onValueChange={(value) => setEditTool(prev => prev ? { ...prev, category: value } : null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Electric Tool">Electric Tool</SelectItem>
                        <SelectItem value="Vehicle">Vehicle</SelectItem>
                        <SelectItem value="Combustion Engine">Combustion Engine</SelectItem>
                        <SelectItem value="Hand Tools">Hand Tools</SelectItem>
                        <SelectItem value="Recreation">Recreation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select 
                      value={editTool.condition} 
                      onValueChange={(value) => setEditTool(prev => prev ? { ...prev, condition: value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="no_problems_observed">No problems detected</SelectItem>
                          <SelectItem value="functional_but_not_efficient">Functional but inefficient</SelectItem>
                         <SelectItem value="not_functional">Not functional</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status and Intended Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={editTool.status} 
                      onValueChange={(value) => setEditTool(prev => prev ? { ...prev, status: value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="available">Available</SelectItem>
                         <SelectItem value="checked_out">Checked Out</SelectItem>
                         <SelectItem value="unavailable">Unavailable</SelectItem>
                         <SelectItem value="unable_to_find">Unable to Find</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="edit-storage-vicinity">Storage Vicinity *</Label>
                     <Select value={editTool.storage_vicinity} onValueChange={(value) => setEditTool(prev => prev ? { ...prev, storage_vicinity: value } : null)}>
                       <SelectTrigger>
                         <SelectValue placeholder="Select storage vicinity..." />
                       </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Composter Area">Composter Area</SelectItem>
                          <SelectItem value="Guest House">Guest House</SelectItem>
                          <SelectItem value="Storage Shed">Storage Shed</SelectItem>
                          <SelectItem value="ATI Learning Site">ATI Learning Site</SelectItem>
                          <SelectItem value="ATI Accomodations">ATI Accomodations</SelectItem>
                          <SelectItem value="ATI CR">ATI CR</SelectItem>
                          <SelectItem value="Lanai">Lanai</SelectItem>
                        </SelectContent>
                     </Select>
                   </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-storage-location">Storage Location</Label>
                    <Input
                      id="edit-storage-location"
                      value={editTool.storage_location || ''}
                      onChange={(e) => setEditTool(prev => prev ? { ...prev, storage_location: e.target.value } : null)}
                      placeholder="e.g., Shelf A-3, Toolbox #2"
                    />
                  </div>
                </div>

                {/* Serial Number */}
                <div className="space-y-2">
                  <Label htmlFor="edit-serial">Serial Number *</Label>
                  <Input
                    id="edit-serial"
                    value={editTool.serial_number || ''}
                    onChange={(e) => setEditTool(prev => prev ? { ...prev, serial_number: e.target.value } : null)}
                    placeholder="Enter serial number"
                    required
                  />
                </div>


                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                   <Button type="submit" disabled={isSubmitting || !editTool.name || !editTool.storage_vicinity || !editTool.serial_number}>
                     {isSubmitting ? "Updating..." : "Update Tool"}
                   </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Remove Tool Dialog */}
        <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Remove Tool</DialogTitle>
            </DialogHeader>
            
            {toolToRemove && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to remove <strong>{toolToRemove.name}</strong>? This will mark the tool as removed.
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="remove-reason">Reason for removal *</Label>
                    <Select value={removeReason} onValueChange={setRemoveReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accidentally_added">Accidentally added</SelectItem>
                        <SelectItem value="duplicate_entry">Duplicate Entry</SelectItem>
                        <SelectItem value="tool_broken_unrecoverable">Tool is broken and unrecoverable</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remove-comment">Notes</Label>
                    <Textarea
                      id="remove-comment"
                      value={removeComment}
                      onChange={(e) => setRemoveComment(e.target.value)}
                      placeholder="Enter any additional details about the removal..."
                      rows={3}
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="removal-images">Upload Pictures (optional)</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          id="removal-images"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleRemoveImageChange}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('removal-images')?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {removeImagePreviews.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {removeImagePreviews.map((preview, index) => (
                            <div key={index} className="relative">
                              <img
                                src={preview}
                                alt={`Removal evidence ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0"
                                onClick={() => removeRemovalImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsRemoveDialogOpen(false);
                      setRemoveReason("");
                      setRemoveComment("");
                      setRemoveImageFiles([]);
                      setRemoveImagePreviews([]);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleRemoveTool}
                    disabled={isSubmitting || !removeReason}
                  >
                    {isSubmitting ? "Removing..." : "Remove Tool"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </main>
    </div>
  );
}