import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink, Camera, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Tool {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  condition: string;
  status: string;
  intended_storage_location: string;
  serial_number: string | null;
  manual_url: string | null;
}

const CheckoutTool = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    user_name: "",
    intended_usage: "",
    notes: "",
    expected_return_date: "",
  });
  const [beforeImages, setBeforeImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('status', 'available')
        .order('name');

      if (error) throw error;
      setTools(data || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast({
        title: "Error",
        description: "Failed to load tools",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + beforeImages.length > 5) {
      toast({
        title: "Too many images",
        description: "Maximum 5 images allowed",
        variant: "destructive",
      });
      return;
    }

    setBeforeImages(prev => [...prev, ...files]);
    
    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setBeforeImages(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `checkout-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tool-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('tool-images')
        .getPublicUrl(filePath);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;

    setSubmitting(true);
    try {
      let beforeImageUrl = null;
      
      if (beforeImages.length > 0) {
        const imageUrls = await uploadImages(beforeImages);
        beforeImageUrl = imageUrls.join(',');
      }

      const { error } = await supabase
        .from('checkouts')
        .insert({
          tool_id: selectedTool.id,
          user_name: checkoutForm.user_name,
          intended_usage: checkoutForm.intended_usage,
          notes: checkoutForm.notes,
          expected_return_date: checkoutForm.expected_return_date || null,
          before_image_url: beforeImageUrl,
        });

      if (error) throw error;

      // Update tool status to checked_out
      const { error: updateError } = await supabase
        .from('tools')
        .update({ status: 'checked_out' })
        .eq('id', selectedTool.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Tool checked out successfully",
      });

      // Reset form and go back to tool list
      setSelectedTool(null);
      setCheckoutForm({
        user_name: "",
        intended_usage: "",
        notes: "",
        expected_return_date: "",
      });
      setBeforeImages([]);
      setImagePreview([]);
      fetchTools();
    } catch (error) {
      console.error('Error checking out tool:', error);
      toast({
        title: "Error",
        description: "Failed to check out tool",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading tools...</div>;
  }

  if (selectedTool) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => setSelectedTool(null)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tools
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Check Out: {selectedTool.name}</CardTitle>
            <div className="flex gap-2">
              {selectedTool.category && (
                <Badge variant="secondary">{selectedTool.category}</Badge>
              )}
              <Badge variant="outline">{selectedTool.condition}</Badge>
            </div>
            {selectedTool.description && (
              <p className="text-muted-foreground">{selectedTool.description}</p>
            )}
            {selectedTool.manual_url && (
              <a
                href={selectedTool.manual_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View SOP/Manual
              </a>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <Label htmlFor="user_name">Your Name *</Label>
                <Input
                  id="user_name"
                  value={checkoutForm.user_name}
                  onChange={(e) => setCheckoutForm(prev => ({ ...prev, user_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="intended_usage">Purpose *</Label>
                <Select
                  value={checkoutForm.intended_usage}
                  onValueChange={(value) => setCheckoutForm(prev => ({ ...prev, intended_usage: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="preventative_maintenance">Preventative Maintenance</SelectItem>
                    <SelectItem value="task">Task/Project Work</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expected_return_date">Expected Return Date</Label>
                <Input
                  id="expected_return_date"
                  type="date"
                  value={checkoutForm.expected_return_date}
                  onChange={(e) => setCheckoutForm(prev => ({ ...prev, expected_return_date: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="notes">Additional Details</Label>
                <Textarea
                  id="notes"
                  value={checkoutForm.notes}
                  onChange={(e) => setCheckoutForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional details about the checkout..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Pre-Checkout Inspection</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Take photos of any pre-existing damage or issues
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="mb-2"
                />
                {imagePreview.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {imagePreview.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Checking Out..." : "Check Out Tool"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTool(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Check Out Tool</h1>
        <p className="text-muted-foreground">Search and select a tool to check out</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search tools by name, category, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredTools.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {searchTerm ? "No tools found matching your search." : "No available tools found."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <Card
              key={tool.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedTool(tool)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{tool.name}</CardTitle>
                <div className="flex gap-2">
                  {tool.category && (
                    <Badge variant="secondary">{tool.category}</Badge>
                  )}
                  <Badge variant="outline">{tool.condition}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {tool.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {tool.description}
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-medium">Location:</span> {tool.intended_storage_location}
                </p>
                {tool.serial_number && (
                  <p className="text-sm">
                    <span className="font-medium">Serial:</span> {tool.serial_number}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckoutTool;