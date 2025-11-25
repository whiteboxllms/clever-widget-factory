import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ClipboardCheck, Package, Wrench, Search, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';

interface Tool {
  id: string;
  name: string;
  parent_structure_id?: string;
  parent_structure_name?: string;
  storage_location: string;
  last_audited_at: string | null;
  audit_info?: {
    audited_by: string;
    audited_at: string;
    auditor_name: string;
  };
}

const Audit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<'tools' | 'inventory' | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [auditQuantity, setAuditQuantity] = useState(5);
  const [generatedAudit, setGeneratedAudit] = useState<Tool[]>([]);
  const [currentStep, setCurrentStep] = useState<'type' | 'structure' | 'quantity' | 'execute'>('type');

  // Handle returning from tool audit with URL parameters
  useEffect(() => {
    const step = searchParams.get('step');
    if (step === 'execute') {
      // Restore state from sessionStorage if available
      const storedAuditData = sessionStorage.getItem('currentAudit');
      if (storedAuditData) {
        const auditData = JSON.parse(storedAuditData);
        
        // Check if this is old vicinity-based data, if so clear it
        if (auditData.selectedVicinity && !auditData.selectedStructure) {
          sessionStorage.removeItem('currentAudit');
          return;
        }
        
        setSelectedType(auditData.selectedType);
        setSelectedStructure(auditData.selectedStructure);
        setAuditQuantity(auditData.auditQuantity);
        setGeneratedAudit(auditData.generatedAudit);
        setCurrentStep('execute');
        // Refresh audit data to get updated audit status
        refreshAuditData(auditData.generatedAudit);
      }
    }
  }, [searchParams]);

  // Save audit state to sessionStorage when generating audit
  const saveAuditState = (auditData: any) => {
    sessionStorage.setItem('currentAudit', JSON.stringify(auditData));
  };

  // Refresh audit data to check for updated audit status
  const refreshAuditData = async (currentAudit: Tool[]) => {
    try {
      const toolIds = currentAudit.map(tool => tool.id);
      
      // Get updated tool data with parent structure information
      const { data: updatedTools, error: toolsError } = await supabase
        .from('tools')
        .select(`
          id, 
          name, 
          parent_structure_id, 
          storage_location, 
          last_audited_at,
          parent_structure:tools!parent_structure_id(name)
        `)
        .in('id', toolIds);

      if (toolsError) throw toolsError;

      // Get audit information for tools audited today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: auditData, error: auditError } = await supabase
        .from('tool_audits')
        .select(`
          tool_id,
          audited_by,
          audited_at
        `)
        .in('tool_id', toolIds)
        .gte('audited_at', today.toISOString())
        .order('audited_at', { ascending: false });

      if (auditError) throw auditError;

      // Get auditor names
      const auditorIds = auditData?.map(audit => audit.audited_by) || [];
      let profilesData: any[] = [];
      
      if (auditorIds.length > 0) {
        // Use secure function instead of direct table access
        const { data: profiles, error: profilesError } = await supabase
          .rpc('get_user_display_names');
          
        if (!profilesError) {
          // Filter to only requested auditor IDs
          profilesData = (profiles || []).filter(p => auditorIds.includes(p.user_id));
        }
      }

      // Update the audit list with fresh data and audit info
      const refreshedAudit = currentAudit.map(tool => {
        const updatedTool = updatedTools?.find(t => t.id === tool.id);
        const auditInfo = auditData?.find(audit => audit.tool_id === tool.id);
        
        const result: Tool = {
          ...(updatedTool || tool),
          parent_structure_name: updatedTool?.parent_structure?.name || tool.parent_structure_name || 'Unassigned'
        };
        
        if (auditInfo) {
          const auditorProfile = profilesData.find(p => p.user_id === auditInfo.audited_by);
          if (!auditorProfile?.full_name) {
            throw new Error(`Auditor profile not found for audit conducted by user ${auditInfo.audited_by}`);
          }
          result.audit_info = {
            audited_by: auditInfo.audited_by,
            audited_at: auditInfo.audited_at,
            auditor_name: auditorProfile.full_name
          };
        }
        
        return result;
      });

      setGeneratedAudit(refreshedAudit);
    } catch (error) {
      console.error('Error refreshing audit data:', error);
    }
  };

  // Check if a tool was audited today
  const isToolAuditedToday = (tool: Tool) => {
    if (!tool.last_audited_at) return false;
    const auditDate = new Date(tool.last_audited_at);
    const today = new Date();
    return auditDate.toDateString() === today.toDateString();
  };

  // Get available structures based on selected type
  const { data: structures, isLoading: structureLoading } = useQuery({
    queryKey: ['audit-structures', selectedType],
    queryFn: async () => {
      if (!selectedType) return [];
      
      if (selectedType === 'tools') {
        // Get all available tools and all parent structures separately
        const [toolsResponse, structuresResponse] = await Promise.all([
          supabase
            .from('tools')
            .select('parent_structure_id')
            .eq('status', 'available'),
          supabase
            .from('tools')
            .select('id, name')
            .in('category', ['Infrastructure', 'Container'])
            .neq('status', 'removed')
        ]);
        
        if (toolsResponse.error) throw toolsResponse.error;
        if (structuresResponse.error) throw structuresResponse.error;
        
        // Create lookup map for parent structure names
        const structureNameMap = new Map<string, string>();
        structuresResponse.data.forEach(structure => {
          structureNameMap.set(structure.id, structure.name);
        });
        
        // Count tools by structure
        const structureMap = new Map<string, { id: string | null; name: string; count: number }>();
        
        toolsResponse.data.forEach((tool) => {
          const structureId = tool.parent_structure_id;
          const structureName = structureId ? structureNameMap.get(structureId) || 'Unknown Structure' : 'Unassigned';
          const key = structureId || 'unassigned';
          
          if (structureMap.has(key)) {
            structureMap.get(key)!.count++;
          } else {
            structureMap.set(key, {
              id: structureId,
              name: structureName,
              count: 1
            });
          }
        });
        
        return Array.from(structureMap.values())
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      
      // For inventory (parts) - not implemented yet
      return [];
    },
    enabled: !!selectedType
  });

  const generateAudit = async () => {
    if (!selectedType || !selectedStructure) return;

    try {
      // Build query based on selected structure
      let query = supabase
        .from('tools')
        .select(`
          id, 
          name, 
          parent_structure_id, 
          storage_location, 
          last_audited_at,
          parent_structure:tools!parent_structure_id(name)
        `)
        .eq('status', 'available')
        .order('last_audited_at', { ascending: true, nullsFirst: true })
        .limit(50); // Get more than needed for randomization

      // Filter by structure or unassigned
      if (selectedStructure === 'unassigned') {
        query = query.is('parent_structure_id', null);
      } else {
        query = query.eq('parent_structure_id', selectedStructure);
      }

      const { data: tools, error } = await query;
      if (error) throw error;

      // Separate never audited and previously audited
      const neverAudited = tools.filter(tool => !tool.last_audited_at);
      const previouslyAudited = tools.filter(tool => tool.last_audited_at);

      // Start with never audited tools
      let selectedTools = [...neverAudited];

      // If we need more tools, add from previously audited (least recent first)
      if (selectedTools.length < auditQuantity) {
        const remaining = auditQuantity - selectedTools.length;
        selectedTools = [...selectedTools, ...previouslyAudited.slice(0, remaining)];
      }

      // If we have more than needed, randomly select from the pool
      if (selectedTools.length > auditQuantity) {
        selectedTools = selectedTools
          .sort(() => Math.random() - 0.5)
          .slice(0, auditQuantity);
      }

      setGeneratedAudit(selectedTools);
      setCurrentStep('execute');

      // Add parent structure name to selected tools
      const toolsWithStructure = selectedTools.map(tool => ({
        ...tool,
        parent_structure_name: tool.parent_structure?.name || 'Unassigned'
      }));

      setGeneratedAudit(toolsWithStructure);

      // Save audit state for potential restoration
      const auditState = {
        selectedType,
        selectedStructure,
        auditQuantity,
        generatedAudit: toolsWithStructure
      };
      saveAuditState(auditState);

      const structureName = structures?.find(s => s.id === selectedStructure)?.name || 'Unassigned';
      toast({
        title: "Audit Generated",
        description: `Generated audit for ${toolsWithStructure.length} tools in ${structureName}`,
      });
    } catch (error) {
      console.error('Error generating audit:', error);
      toast({
        title: "Error",
        description: "Failed to generate audit. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetAudit = () => {
    setSelectedType(null);
    setSelectedStructure('');
    setAuditQuantity(5);
    setGeneratedAudit([]);
    setCurrentStep('type');
    sessionStorage.removeItem('currentAudit');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Tool & Inventory Audit</h1>
              <p className="text-muted-foreground">Verify item locations and conditions</p>
            </div>
          </div>
          <Button onClick={resetAudit} variant="outline">
            Start New Audit
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-4xl mx-auto">
        {/* Step 1: Type Selection */}
        {currentStep === 'type' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Select Audit Type</h2>
              <p className="text-muted-foreground">Choose what you want to audit</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card 
                className={`cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${
                  selectedType === 'tools' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  setSelectedType('tools');
                  setCurrentStep('structure');
                }}
              >
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-4">
                    <Wrench className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Tools</CardTitle>
                  <CardDescription>Audit tool locations and conditions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Select Tools
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:scale-105 hover:shadow-lg opacity-50 ${
                  selectedType === 'inventory' ? 'ring-2 ring-primary' : ''
                }`}
              >
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Inventory</CardTitle>
                  <CardDescription>Audit inventory locations and quantities (Coming Soon)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Structure Selection */}
        {currentStep === 'structure' && selectedType && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Select Structure/Container</h2>
              <p className="text-muted-foreground">Choose the structure to audit</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Available Structures</CardTitle>
                <CardDescription>Select a structure or container to audit {selectedType}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="structure">Structure/Container</Label>
                  <Select 
                    value={selectedStructure} 
                    onValueChange={setSelectedStructure}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a structure..." />
                    </SelectTrigger>
                    <SelectContent>
                      {structureLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        structures?.map(structure => (
                          <SelectItem 
                            key={structure.id || 'unassigned'} 
                            value={structure.id || 'unassigned'}
                          >
                            {structure.name} ({structure.count} items)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('type')}
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep('quantity')}
                    disabled={!selectedStructure}
                  >
                    Next: Set Quantity
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Quantity Selection */}
        {currentStep === 'quantity' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Audit Quantity</h2>
              <p className="text-muted-foreground">How many items should we audit?</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Audit Parameters</CardTitle>
                <CardDescription>Set the number of items to audit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Number of Items (1-20)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max="20"
                    value={auditQuantity}
                    onChange={(e) => setAuditQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Items are selected by prioritizing never-audited items first, then least recently audited.
                  </p>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Audit Summary</h4>
                  <p><strong>Type:</strong> {selectedType}</p>
                  <p><strong>Structure:</strong> {structures?.find(s => s.id === selectedStructure || (s.id === null && selectedStructure === 'unassigned'))?.name || selectedStructure}</p>
                  <p><strong>Quantity:</strong> {auditQuantity} items</p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('structure')}
                  >
                    Back
                  </Button>
                  <Button onClick={generateAudit}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Generate Audit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Execute Audit */}
        {currentStep === 'execute' && generatedAudit.length > 0 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Execute Audit</h2>
              <p className="text-muted-foreground">
                Audit {generatedAudit.length} tools in {structures?.find(s => s.id === selectedStructure || (s.id === null && selectedStructure === 'unassigned'))?.name || 'Selected Structure'}
              </p>
            </div>

            <div className="grid gap-4">
              {generatedAudit.map((tool, index) => {
                const isAudited = isToolAuditedToday(tool);
                return (
                  <Card 
                    key={tool.id}
                    className={`relative ${isAudited ? 'border-green-500 border-2 bg-green-50' : ''}`}
                  >
                    {isAudited && (
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex justify-between items-start pr-8">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {index + 1}. {tool.name}
                            {isAudited && (
                              <span className="text-sm font-normal text-green-600 bg-green-100 px-2 py-1 rounded">
                                Audited Today
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Expected: {tool.parent_structure_name || 'Unassigned'} → {tool.storage_location || 'No specific location'}
                          </CardDescription>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>
                            {tool.last_audited_at ? (
                              `Last audited: ${new Date(tool.last_audited_at).toLocaleDateString()}`
                            ) : (
                              'Never audited'
                            )}
                          </div>
                          {tool.audit_info && (
                            <div className="text-green-600 font-medium mt-1 text-right">
                              Audited by {tool.audit_info.auditor_name} at {new Date(tool.audit_info.audited_at).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full" 
                        onClick={() => navigate(`/audit/tool/${tool.id}`)}
                        variant={isAudited ? "outline" : "default"}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        {isAudited ? 'View/Re-audit Tool' : 'Start Audit for this Tool'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('quantity')}
              >
                Back to Quantity
              </Button>
              <Button onClick={resetAudit} variant="secondary">
                Start New Audit
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Audit;