import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, User, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ToolCheckInDialog } from '@/components/ToolCheckInDialog';

type CheckoutWithTool = Tables<'checkouts'> & {
  tools: Tables<'tools'>;
};

export default function CheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [checkouts, setCheckouts] = useState<CheckoutWithTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCheckouts, setShowAllCheckouts] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tables<'tools'> | null>(null);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);

  useEffect(() => {
    fetchCheckouts();
  }, []);

  const fetchCheckouts = async () => {
    try {
      console.log('=== FETCHING CHECKOUTS ===');
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      console.log('Timestamp:', new Date().toISOString());
      
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          tools(*)
        `)
        .eq('is_returned', false)
        .order('checkout_date', { ascending: false });

      console.log('Checkout fetch result:', { data: data?.length, error });
      console.log('Raw data:', data);

      if (error) {
        console.error('Supabase error details:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw error;
      }
      setCheckouts(data || []);
      console.log('Successfully loaded checkouts:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching checkouts:', error);
      console.error('Error type:', typeof error);
      console.error('Error stack:', error?.stack);
      
      // Enhanced error details
      let errorMessage = "Failed to load checked out tools";
      if (error instanceof Error) {
        console.error('Error instance details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        if (error.message.includes('fetch')) {
          errorMessage = "Network error - please check your internet connection";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out - please try again";
        } else if (error.message.includes('CORS')) {
          errorMessage = "CORS error - there may be a configuration issue";
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

  const handleCheckInClick = (checkout: CheckoutWithTool) => {
    setSelectedTool(checkout.tools);
    setShowCheckInDialog(true);
  };

  const handleCheckInSuccess = () => {
    setSelectedTool(null);
    setShowCheckInDialog(false);
    fetchCheckouts();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'checked_out': return 'bg-yellow-100 text-yellow-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      case 'unable_to_find': return 'bg-gray-100 text-gray-800';
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
                      <CardTitle className="text-lg">
                        {checkout.tools.name}
                        {checkout.tools.serial_number && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            {checkout.tools.serial_number}
                          </span>
                        )}
                      </CardTitle>
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
                        <Clock className="h-4 w-4" />
                        <span>Since {new Date(checkout.checkout_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) + ' at ' + new Date(checkout.checkout_date).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getStatusColor(checkout.tools.status)}>
                          {checkout.tools.status}
                        </Badge>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      onClick={() => handleCheckInClick(checkout)}
                    >
                      Check In Tool
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <ToolCheckInDialog 
          tool={selectedTool}
          open={showCheckInDialog}
          onOpenChange={setShowCheckInDialog}
          onSuccess={handleCheckInSuccess}
        />
      </main>
    </div>
  );
}