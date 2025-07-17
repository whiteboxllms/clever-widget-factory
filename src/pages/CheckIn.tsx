import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, User, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type CheckoutWithTool = Tables<'checkouts'> & {
  tools: Tables<'tools'>;
};

type CheckInForm = {
  condition_after: string;
  problems_reported: string;
  location_found: string;
  notes: string;
  returned_to_correct_location: boolean;
  sop_deviation: string;
  suboptimal_comments: string;
};

export default function CheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkouts, setCheckouts] = useState<CheckoutWithTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckout, setSelectedCheckout] = useState<CheckoutWithTool | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CheckInForm>({
    condition_after: '',
    problems_reported: '',
    location_found: '',
    notes: '',
    returned_to_correct_location: true,
    sop_deviation: '',
    suboptimal_comments: ''
  });

  useEffect(() => {
    fetchCheckouts();
  }, []);

  const fetchCheckouts = async () => {
    try {
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          tools(*)
        `)
        .eq('is_returned', false)
        .order('checkout_date', { ascending: false });

      if (error) throw error;
      setCheckouts(data || []);
    } catch (error) {
      console.error('Error fetching checkouts:', error);
      toast({
        title: "Error",
        description: "Failed to load checked out tools",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedCheckout) return;

    setIsSubmitting(true);
    try {
      // Create checkin record
      const { error: checkinError } = await supabase
        .from('checkins')
        .insert({
          checkout_id: selectedCheckout.id,
          tool_id: selectedCheckout.tool_id,
          user_name: selectedCheckout.user_name,
          condition_after: form.condition_after as any,
          problems_reported: form.problems_reported || null,
          location_found: form.location_found || null,
          notes: `${form.notes}\n\nSOP Deviation: ${form.sop_deviation}\nSub-optimal Operation Comments: ${form.suboptimal_comments}`,
          returned_to_correct_location: form.returned_to_correct_location,
        });

      if (checkinError) throw checkinError;

      // Update checkout as returned
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .update({ is_returned: true })
        .eq('id', selectedCheckout.id);

      if (checkoutError) throw checkoutError;

      // Update tool status and condition
      const { error: toolError } = await supabase
        .from('tools')
        .update({ 
          condition: form.condition_after as any,
          status: form.condition_after === 'broken' ? 'broken' : 'available',
          actual_location: form.location_found || selectedCheckout.tools.intended_storage_location
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
        problems_reported: '',
        location_found: '',
        notes: '',
        returned_to_correct_location: true,
        sop_deviation: '',
        suboptimal_comments: ''
      });
      setSelectedCheckout(null);
      
      // Refresh checkouts
      fetchCheckouts();

    } catch (error) {
      console.error('Error checking in tool:', error);
      toast({
        title: "Error",
        description: "Failed to check in tool",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-orange-100 text-orange-800';
      case 'broken': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysOut = (checkoutDate: string) => {
    const days = Math.floor((new Date().getTime() - new Date(checkoutDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
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
        {checkouts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tools checked out</h3>
              <p className="text-muted-foreground">All tools are currently available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {checkouts.map((checkout) => {
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
                            setForm(prev => ({
                              ...prev,
                              location_found: checkout.tools.actual_location || checkout.tools.intended_storage_location
                            }));
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
                                <SelectItem value="excellent">Excellent</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="fair">Fair</SelectItem>
                                <SelectItem value="poor">Poor</SelectItem>
                                <SelectItem value="broken">Broken</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="location_found">Where was the tool found?</Label>
                            <Input
                              id="location_found"
                              value={form.location_found}
                              onChange={(e) => setForm(prev => ({ ...prev, location_found: e.target.value }))}
                              placeholder="Tool location when returned"
                            />
                          </div>

                          <div>
                            <Label htmlFor="problems_reported">Problems or Issues Encountered</Label>
                            <Textarea
                              id="problems_reported"
                              value={form.problems_reported}
                              onChange={(e) => setForm(prev => ({ ...prev, problems_reported: e.target.value }))}
                              placeholder="Report any problems, damage, or malfunctions"
                              rows={3}
                            />
                          </div>

                          <div>
                            <Label htmlFor="sop_deviation">To what degree did you deviate from our SOP and best practices? *</Label>
                            <Select value={form.sop_deviation} onValueChange={(value) => setForm(prev => ({ ...prev, sop_deviation: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select deviation level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No deviation - followed all SOPs</SelectItem>
                                <SelectItem value="minor">Minor deviation - small adjustments made</SelectItem>
                                <SelectItem value="moderate">Moderate deviation - some procedures modified</SelectItem>
                                <SelectItem value="major">Major deviation - significant changes to procedures</SelectItem>
                                <SelectItem value="complete">Complete deviation - SOPs not followed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="suboptimal_comments">Comments about sub-optimal operation</Label>
                            <Textarea
                              id="suboptimal_comments"
                              value={form.suboptimal_comments}
                              onChange={(e) => setForm(prev => ({ ...prev, suboptimal_comments: e.target.value }))}
                              placeholder="Describe any situations where the tool didn't perform as expected or could have been used more effectively"
                              rows={3}
                            />
                          </div>

                          <div>
                            <Label htmlFor="notes">Additional Notes</Label>
                            <Textarea
                              id="notes"
                              value={form.notes}
                              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Any additional comments or observations"
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
                              Tool was returned to its correct storage location
                            </Label>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button
                              onClick={handleCheckIn}
                              disabled={isSubmitting || !form.condition_after || !form.sop_deviation}
                              className="flex-1"
                            >
                              {isSubmitting ? "Checking In..." : "Complete Check In"}
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