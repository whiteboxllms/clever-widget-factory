import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, User, AlertTriangle, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type CheckoutWithTool = Tables<'checkouts'> & {
  tools: Tables<'tools'>;
};

type CheckInForm = {
  condition_after: string;
  tool_issues: string;
  notes: string;
  returned_to_correct_location: boolean;
  sop_best_practices: string;
  what_did_you_do: string;
  hours_used: string;
};

type IssueResolution = {
  issue: string;
  rootCause: string;
  bestPractice: string;
  actionTaken: string;
};

export default function CheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [checkouts, setCheckouts] = useState<CheckoutWithTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCheckouts, setShowAllCheckouts] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<CheckoutWithTool | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CheckInForm>({
    condition_after: '',
    tool_issues: '',
    notes: '',
    returned_to_correct_location: true,
    sop_best_practices: '',
    what_did_you_do: '',
    hours_used: ''
  });
  const [resolvedIssues, setResolvedIssues] = useState<IssueResolution[]>([]);
  const [showIssueResolution, setShowIssueResolution] = useState<string | null>(null);
  const [issueResolutionForm, setIssueResolutionForm] = useState({
    rootCause: '',
    bestPractice: '',
    actionTaken: ''
  });
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    fetchCheckouts();
  }, []);

  const fetchCheckouts = async () => {
    try {
      console.log('=== FETCHING CHECKOUTS ===');
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          tools(*)
        `)
        .eq('is_returned', false)
        .order('checkout_date', { ascending: false });

      console.log('Checkout fetch result:', { data: data?.length, error });

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }
      setCheckouts(data || []);
      console.log('Successfully loaded checkouts:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching checkouts:', error);
      
      // Enhanced error details
      let errorMessage = "Failed to load checked out tools";
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = "Network error - please check your internet connection";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out - please try again";
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedCheckout) return;

    console.log('=== STARTING TOOL CHECK-IN ===');
    console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
    console.log('Selected checkout:', selectedCheckout.id);
    console.log('Form data:', form);

    setIsSubmitting(true);
    setUploadingImages(true);
    try {
      // Upload images to storage if any
      let imageUrls: string[] = [];
      if (uploadedImages.length > 0) {
        console.log('Uploading images:', uploadedImages.length);
        
        for (const [index, file] of uploadedImages.entries()) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedCheckout.tool_id}_${selectedCheckout.id}_${Date.now()}_${index + 1}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tool-checkout-images')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('tool-checkout-images')
            .getPublicUrl(fileName);
          
          imageUrls.push(publicUrl);
        }
        console.log('Images uploaded successfully:', imageUrls);
      }

      // Create checkin record
      const checkinData: any = {
        checkout_id: selectedCheckout.id,
        tool_id: selectedCheckout.tool_id,
        user_name: selectedCheckout.user_name,
        condition_after: form.condition_after as any,
        problems_reported: form.tool_issues || null,
        location_found: selectedCheckout.tools.storage_vicinity + (selectedCheckout.tools.storage_location ? ` - ${selectedCheckout.tools.storage_location}` : ''),
        notes: form.notes || null,
        returned_to_correct_location: form.returned_to_correct_location,
        sop_best_practices: form.sop_best_practices,
        what_did_you_do: form.what_did_you_do,
        after_image_urls: imageUrls,
      };

      console.log('CheckIn - Form data:', form);
      console.log('CheckIn - Checkin data to insert:', checkinData);

      // Add hours used if tool has motor and hours were provided
      if (selectedCheckout.tools.has_motor && form.hours_used) {
        checkinData.hours_used = parseFloat(form.hours_used);
      }

      const { error: checkinError } = await supabase
        .from('checkins')
        .insert(checkinData);

      if (checkinError) throw checkinError;

      // Update checkout as returned
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .update({ is_returned: true })
        .eq('id', selectedCheckout.id);

      if (checkoutError) throw checkoutError;

      // Update tool status, condition, and remove resolved issues
      let updatedKnownIssues = selectedCheckout.tools.known_issues;
      if (resolvedIssues.length > 0) {
        // Remove resolved issues from known_issues
        const resolvedIssueTexts = resolvedIssues.map(r => r.issue);
        const currentIssues = updatedKnownIssues ? updatedKnownIssues.split('\n').filter(issue => issue.trim()) : [];
        const remainingIssues = currentIssues.filter(issue => !resolvedIssueTexts.some(resolved => issue.includes(resolved)));
        updatedKnownIssues = remainingIssues.length > 0 ? remainingIssues.join('\n') : null;
        
        // Add resolution notes to checkin notes
        const resolutionNotes = resolvedIssues.map(r => 
          `ISSUE RESOLVED: ${r.issue}\nRoot Cause: ${r.rootCause}\nBest Practice: ${r.bestPractice}\nAction Taken: ${r.actionTaken}`
        ).join('\n\n');
        
        checkinData.notes = checkinData.notes ? `${checkinData.notes}\n\n${resolutionNotes}` : resolutionNotes;
      }

      const { error: toolError } = await supabase
        .from('tools')
        .update({ 
          condition: form.condition_after as any,
          status: form.condition_after === 'not_functional' ? 'unavailable' : 'available',
          actual_location: selectedCheckout.tools.storage_vicinity + (selectedCheckout.tools.storage_location ? ` - ${selectedCheckout.tools.storage_location}` : ''),
          known_issues: updatedKnownIssues
        })
        .eq('id', selectedCheckout.tool_id);

      if (toolError) throw toolError;

      toast({
        title: "Tool checked in successfully",
        description: `${selectedCheckout.tools.name} has been checked in`,
      });

      // Reset form and close dialog
      setForm({
        condition_after: '',
        tool_issues: '',
        notes: '',
        returned_to_correct_location: true,
        sop_best_practices: '',
        what_did_you_do: '',
        hours_used: ''
      });
      setResolvedIssues([]);
      setShowIssueResolution(null);
      setIssueResolutionForm({
        rootCause: '',
        bestPractice: '',
        actionTaken: ''
      });
      setUploadedImages([]);
      setSelectedCheckout(null);
      
      // Refresh checkouts
      fetchCheckouts();

    } catch (error) {
      console.error('Error checking in tool:', error);
      
      let errorMessage = "Failed to check in tool";
      let errorDetails = "";
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorDetails = String(error.message);
        console.log('Detailed error:', errorDetails);
        
        // Provide specific guidance based on common error types
        if (errorDetails.includes('violates row-level security')) {
          errorMessage = "Permission denied";
          errorDetails = "You don't have permission to check in this tool. Please ensure you're logged in and have the necessary access rights.";
        } else if (errorDetails.includes('null value') || errorDetails.includes('not-null constraint')) {
          errorMessage = "Missing required information";
          errorDetails = "Please fill in all required fields: Tool Condition, SOP Best Practices, and What Did You Do are mandatory.";
        } else if (errorDetails.includes('foreign key')) {
          errorMessage = "Data reference error";
          errorDetails = "There's an issue with the checkout record. Please try refreshing the page and checking in again.";
        } else if (errorDetails.includes('duplicate key')) {
          errorMessage = "Check-in already exists";
          errorDetails = "This tool may have already been checked in. Please refresh the page to see the current status.";
        }
      }
      
      toast({
        title: errorMessage,
        description: errorDetails || "An unexpected error occurred. Please check that all required fields are filled and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setUploadingImages(false);
    }
  };

  const getStatusColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'functional_but_not_efficient': return 'bg-yellow-100 text-yellow-800';
      case 'not_functional': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysOut = (checkoutDate: string) => {
    const days = Math.floor((new Date().getTime() - new Date(checkoutDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleRemoveIssue = (issue: string) => {
    setShowIssueResolution(issue);
  };

  const confirmIssueResolution = () => {
    if (!showIssueResolution) return;
    
    const newResolution: IssueResolution = {
      issue: showIssueResolution,
      rootCause: issueResolutionForm.rootCause,
      bestPractice: issueResolutionForm.bestPractice,
      actionTaken: issueResolutionForm.actionTaken
    };
    
    setResolvedIssues(prev => [...prev, newResolution]);
    setShowIssueResolution(null);
    setIssueResolutionForm({
      rootCause: '',
      bestPractice: '',
      actionTaken: ''
    });
  };

  const getKnownIssues = (knownIssues: string | null) => {
    if (!knownIssues) return [];
    return knownIssues.split('\n').filter(issue => issue.trim());
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploadedImages(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading checked out tools...</p>
        </div>
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
            <h1 className="text-2xl font-bold">Check In Tools</h1>
            <p className="text-muted-foreground">Return tools and report their condition</p>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch 
              id="show-all" 
              checked={showAllCheckouts} 
              onCheckedChange={setShowAllCheckouts}
            />
            <Label htmlFor="show-all">Show all checked out tools</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {showAllCheckouts ? `${checkouts.length} tools checked out` : `${checkouts.filter(c => c.user_id === user?.id).length} of your tools checked out`}
          </div>
        </div>

        {(showAllCheckouts ? checkouts : checkouts.filter(c => c.user_id === user?.id)).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {showAllCheckouts ? 'No tools checked out' : 'No tools checked out by you'}
              </h3>
              <p className="text-muted-foreground">
                {showAllCheckouts ? 'All tools are currently available.' : 'You have no tools checked out.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(showAllCheckouts ? checkouts : checkouts.filter(c => c.user_id === user?.id)).map((checkout) => {
              const daysOut = getDaysOut(checkout.checkout_date);
              const isOverdue = daysOut > 7; // Consider overdue after 7 days

              return (
                <Card key={checkout.id} className={`cursor-pointer transition-all hover:shadow-lg ${isOverdue ? 'border-orange-300' : ''}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{checkout.tools.name}</CardTitle>
                      {isOverdue && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                    </div>
                    <CardDescription className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{checkout.user_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Out for {daysOut} day{daysOut !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getStatusColor(checkout.tools.condition)}>
                          {checkout.tools.condition}
                        </Badge>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            setSelectedCheckout(checkout);
                          }}
                        >
                          Check In Tool
                        </Button>
                      </DialogTrigger>
                      
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Check In: {checkout.tools.name}</DialogTitle>
                          <DialogDescription>
                            Checked out by {checkout.user_name} on {new Date(checkout.checkout_date).toLocaleDateString()}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="condition_after">Tool Condition After Use *</Label>
                            <Select value={form.condition_after} onValueChange={(value) => setForm(prev => ({ ...prev, condition_after: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="functional_but_not_efficient">Functional but not as efficient as it could be</SelectItem>
                                <SelectItem value="not_functional">Not functional</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="tool_issues">Tool Issues encountered not seen previously (add to known issues)</Label>
                            <Textarea
                              id="tool_issues"
                              value={form.tool_issues}
                              onChange={(e) => setForm(prev => ({ ...prev, tool_issues: e.target.value }))}
                              placeholder="Report any new problems, damage, or malfunctions that will be added to the tool's known issues"
                              rows={3}
                            />
                          </div>

                          {checkout.tools.has_motor && (
                            <div>
                              <Label htmlFor="hours_used">Hours Used</Label>
                              <Input
                                id="hours_used"
                                type="number"
                                step="0.1"
                                min="0"
                                value={form.hours_used}
                                onChange={(e) => setForm(prev => ({ ...prev, hours_used: e.target.value }))}
                                placeholder="Enter hours used (e.g., 2.5)"
                              />
                            </div>
                          )}

          <div>
            <Label htmlFor="sop_best_practices">What is the SOP / best practices in this situation? *</Label>
            <div className="flex gap-2">
              <Textarea
                id="sop_best_practices"
                value={form.sop_best_practices}
                onChange={(e) => setForm(prev => ({ ...prev, sop_best_practices: e.target.value }))}
                placeholder="Describe the standard operating procedures or best practices for this tool/situation"
                rows={3}
                className="flex-1"
              />
              {checkout.tools.manual_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(checkout.tools.manual_url, '_blank')}
                  className="flex items-center gap-1"
                >
                  SOP
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="what_did_you_do">What did you do and why? *</Label>
            <Textarea
              id="what_did_you_do"
              value={form.what_did_you_do}
              onChange={(e) => setForm(prev => ({ ...prev, what_did_you_do: e.target.value }))}
              placeholder="Describe what actions you took while using the tool and your reasoning"
              rows={3}
            />
          </div>

                           {/* Known Issues Management */}
                           {checkout.tools.known_issues && (
                             <div>
                               <Label>Current Known Issues</Label>
                               <div className="space-y-2 mt-2 p-3 bg-muted rounded-md">
                                 {getKnownIssues(checkout.tools.known_issues)
                                   .filter(issue => !resolvedIssues.some(r => r.issue === issue))
                                   .map((issue, index) => (
                                   <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                                     <span className="text-sm">{issue}</span>
                                     <Button
                                       type="button"
                                       variant="outline"
                                       size="sm"
                                       onClick={() => handleRemoveIssue(issue)}
                                       className="text-red-600 hover:text-red-700"
                                     >
                                       <X className="h-4 w-4" />
                                       Mark as Resolved
                                     </Button>
                                   </div>
                                 ))}
                                 {resolvedIssues.length > 0 && (
                                   <div className="mt-3">
                                     <p className="text-sm font-medium text-green-700 mb-2">Issues marked for resolution:</p>
                                     {resolvedIssues.map((resolution, index) => (
                                       <div key={index} className="text-sm p-2 bg-green-50 rounded border border-green-200">
                                         <strong>{resolution.issue}</strong> - Will be removed after check-in
                                       </div>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}

                           {/* Issue Resolution Dialog */}
                           {showIssueResolution && (
                             <Dialog open={!!showIssueResolution} onOpenChange={() => setShowIssueResolution(null)}>
                               <DialogContent className="max-w-lg">
                                 <DialogHeader>
                                   <DialogTitle>Issue Resolution Documentation</DialogTitle>
                                   <DialogDescription>
                                     Document the resolution of: "{showIssueResolution}"
                                   </DialogDescription>
                                 </DialogHeader>
                                 <div className="space-y-4">
                                   <div>
                                     <Label htmlFor="rootCause">Root Cause *</Label>
                                     <Textarea
                                       id="rootCause"
                                       value={issueResolutionForm.rootCause}
                                       onChange={(e) => setIssueResolutionForm(prev => ({ ...prev, rootCause: e.target.value }))}
                                       placeholder="What was the underlying cause of this issue?"
                                       rows={3}
                                     />
                                   </div>
                                   <div>
                                     <Label htmlFor="bestPractice">Best Practice *</Label>
                                     <Textarea
                                       id="bestPractice"
                                       value={issueResolutionForm.bestPractice}
                                       onChange={(e) => setIssueResolutionForm(prev => ({ ...prev, bestPractice: e.target.value }))}
                                       placeholder="What is the recommended best practice to prevent this issue?"
                                       rows={3}
                                     />
                                   </div>
                                   <div>
                                     <Label htmlFor="actionTaken">Action Taken *</Label>
                                     <Textarea
                                       id="actionTaken"
                                       value={issueResolutionForm.actionTaken}
                                       onChange={(e) => setIssueResolutionForm(prev => ({ ...prev, actionTaken: e.target.value }))}
                                       placeholder="What specific action did you take to resolve this issue?"
                                       rows={3}
                                     />
                                   </div>
                                   <div className="flex gap-2 pt-4">
                                     <Button
                                       variant="outline"
                                       onClick={() => setShowIssueResolution(null)}
                                       className="flex-1"
                                     >
                                       Cancel
                                     </Button>
                                     <Button
                                       onClick={confirmIssueResolution}
                                       disabled={!issueResolutionForm.rootCause || !issueResolutionForm.bestPractice || !issueResolutionForm.actionTaken}
                                       className="flex-1"
                                     >
                                       Confirm Resolution
                                     </Button>
                                   </div>
                                 </div>
                               </DialogContent>
                             </Dialog>
                           )}

                           {/* Image Upload Section */}
                           <div>
                             <Label htmlFor="images">Attach Images (Optional)</Label>
                             <Input
                               id="images"
                               type="file"
                               accept="image/*"
                               multiple
                               onChange={handleImageUpload}
                               className="mt-2"
                             />
                             <p className="text-sm text-muted-foreground mt-1">
                               Upload multiple images showing the tool's condition after use
                             </p>
                             
                             {/* Image Preview */}
                             {uploadedImages.length > 0 && (
                               <div className="mt-3">
                                 <p className="text-sm font-medium mb-2">Selected Images ({uploadedImages.length}):</p>
                                 <div className="grid grid-cols-2 gap-2">
                                   {uploadedImages.map((file, index) => (
                                     <div key={index} className="relative group">
                                       <img
                                         src={URL.createObjectURL(file)}
                                         alt={`Upload ${index + 1}`}
                                         className="w-full h-20 object-cover rounded border"
                                       />
                                       <Button
                                         type="button"
                                         variant="destructive"
                                         size="sm"
                                         className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                         onClick={() => removeImage(index)}
                                       >
                                         <X className="h-3 w-3" />
                                       </Button>
                                       <p className="text-xs text-center mt-1 truncate px-1">
                                         {file.name}
                                       </p>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>

                           <div>
                             <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              value={form.notes}
                              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Any additional comments, observations, or notes about sub-optimal operation"
                              rows={3}
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="returned_to_correct_location"
                              checked={form.returned_to_correct_location}
                              onChange={(e) => setForm(prev => ({ ...prev, returned_to_correct_location: e.target.checked }))}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="returned_to_correct_location">
                              Tool was returned to its correct storage location: {checkout.tools.storage_vicinity}{checkout.tools.storage_location ? ` - ${checkout.tools.storage_location}` : ''}
                            </Label>
                          </div>

                           <div className="flex gap-2 pt-4">
                             <Button
                               onClick={handleCheckIn}
                               disabled={isSubmitting || !form.condition_after || !form.sop_best_practices || !form.what_did_you_do || uploadingImages}
                               className="flex-1"
                             >
                               {uploadingImages ? "Uploading Images..." : isSubmitting ? "Checking In..." : "Complete Check In"}
                             </Button>
                           </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}