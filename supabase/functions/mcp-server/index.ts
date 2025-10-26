import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for MCP server
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Default organization for testing (Stargazer Farm)
const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

// MCP Server for Supabase Edge Functions
Deno.serve(async (req) => {
  console.log('🚀 MCP Server received request:', req.method, req.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (health check)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      name: 'clever-widget-factory-mcp',
      version: '1.0.0',
      status: 'running',
      message: 'MCP Server connected to real database!'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle POST requests (MCP protocol)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('🔧 MCP Request:', JSON.stringify(body, null, 2));

      const { jsonrpc, id, method, params } = body;

      if (jsonrpc !== '2.0') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32600, message: 'Invalid Request' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      switch (method) {
        case 'initialize':
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'clever-widget-factory-mcp',
                version: '1.0.0'
              }
            }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'tools/list':
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'search_parts_inventory',
                  description: 'Search for parts/inventory items in the database',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      search_term: { type: 'string', description: 'What to search for (e.g., "valve", "wire", "tool")' }
                    },
                    required: ['search_term']
                  }
                },
                {
                  name: 'search_tools_assets',
                  description: 'Search for tools/assets in the database',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      search_term: { type: 'string', description: 'What to search for (e.g., "drill", "multimeter")' }
                    },
                    required: ['search_term']
                  }
                },
                {
                  name: 'get_organization_info',
                  description: 'Get information about the current user\'s organization',
                  inputSchema: {
                    type: 'object',
                    properties: {}
                  }
                }
              ]
            }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'tools/call':
          const { name, arguments: args } = params;
          console.log(`🔧 MCP Tool Call: ${name}`, JSON.stringify(args, null, 2));

          const supabase = createSupabaseClient();

          if (name === 'search_parts_inventory') {
            try {
              const searchTerm = args.search_term.toLowerCase();
              
              // Create flexible search terms by splitting and normalizing
              const searchTerms = searchTerm
                .split(/[\s,()]+/) // Split on spaces, commas, parentheses
                .filter(term => term.length > 0) // Remove empty strings
                .map(term => term.trim()); // Trim whitespace
              
              // Build flexible search query with default organization
              let searchQuery = supabase
                .from('parts')
                .select(`
                  id,
                  name,
                  description,
                  category,
                  current_quantity,
                  minimum_quantity,
                  unit,
                  storage_location,
                  storage_vicinity,
                  supplier,
                  cost_per_unit,
                  image_url
                `)
                .eq('organization_id', DEFAULT_ORGANIZATION_ID);
              
                  // Add search conditions for each term
                  if (searchTerms.length > 0) {
                    const orConditions = [];
                    searchTerms.forEach(term => {
                      if (term.length > 0) {
                        orConditions.push(`name.ilike.%${term}%`);
                        orConditions.push(`category.ilike.%${term}%`);
                      }
                    });
                    
                    if (orConditions.length > 0) {
                      searchQuery = searchQuery.or(orConditions.join(','));
                    }
                  }
              
              const { data: parts, error: partsError } = await searchQuery.limit(50);

              if (partsError) {
                console.error('Error searching parts:', partsError);
                throw new Error('Database error searching parts');
              }

              // Score and sort results by relevance (number of matching terms)
              let scoredParts = parts || [];
              if (searchTerms.length > 0) {
                scoredParts = scoredParts.map(part => {
                  let score = 0;
                  const searchText = `${part.name} ${part.category || ''}`.toLowerCase();
                  
                  searchTerms.forEach(term => {
                    if (searchText.includes(term.toLowerCase())) {
                      score++;
                    }
                  });
                  
                  return { ...part, _score: score };
                }).sort((a, b) => b._score - a._score);
              }
              
              // Return only top 10 results for agent confirmation
              scoredParts = scoredParts.slice(0, 10);

              const result = {
                success: true,
                data: {
                  search_term: args.search_term,
                  search_type: 'parts',
                  results: scoredParts,
                  total_found: scoredParts.length,
                  available_count: scoredParts.filter(p => p.current_quantity > 0).length,
                  message: parts && parts.length > 0 
                    ? `Found ${parts.length} parts matching "${args.search_term}"`
                    : `No parts found matching "${args.search_term}"`
                },
                timestamp: new Date().toISOString()
              };
              
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(result, null, 2)
                    }
                  ]
                }
              }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } catch (error) {
              console.error('Error in search_parts_inventory:', error);
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: error.message }
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }

          if (name === 'search_tools_assets') {
            try {
              const searchTerm = args.search_term.toLowerCase();
              
              // Create flexible search terms by splitting and normalizing
              const searchTerms = searchTerm
                .split(/[\s,()]+/) // Split on spaces, commas, parentheses
                .filter(term => term.length > 0) // Remove empty strings
                .map(term => term.trim()); // Trim whitespace
              
              // Build flexible search query with default organization
              let searchQuery = supabase
                .from('tools')
                .select(`
                  id,
                  name,
                  description,
                  category,
                  status,
                  storage_location,
                  actual_location,
                  serial_number,
                  has_motor,
                  known_issues,
                  last_audited_at,
                  last_maintenance,
                  image_url,
                  manual_url,
                  accountable_person_id
                `)
                .eq('organization_id', DEFAULT_ORGANIZATION_ID);
              
                  // Add search conditions for each term
                  if (searchTerms.length > 0) {
                    const orConditions = [];
                    searchTerms.forEach(term => {
                      if (term.length > 0) {
                        orConditions.push(`name.ilike.%${term}%`);
                        orConditions.push(`category.ilike.%${term}%`);
                        orConditions.push(`serial_number.ilike.%${term}%`);
                      }
                    });
                    
                    if (orConditions.length > 0) {
                      searchQuery = searchQuery.or(orConditions.join(','));
                    }
                  }
              
              const { data: tools, error: toolsError } = await searchQuery.limit(50);

              if (toolsError) {
                console.error('Error searching tools:', toolsError);
                throw new Error('Database error searching tools');
              }

              // Score and sort results by relevance (number of matching terms)
              let scoredTools = tools || [];
              if (searchTerms.length > 0) {
                scoredTools = scoredTools.map(tool => {
                  let score = 0;
                  const searchText = `${tool.name} ${tool.category || ''} ${tool.serial_number || ''}`.toLowerCase();
                  
                  searchTerms.forEach(term => {
                    if (searchText.includes(term.toLowerCase())) {
                      score++;
                    }
                  });
                  
                  return { ...tool, _score: score };
                }).sort((a, b) => b._score - a._score);
              }
              
              // Return only top 10 results for agent confirmation
              scoredTools = scoredTools.slice(0, 10);

              const result = {
                success: true,
                data: {
                  search_term: args.search_term,
                  search_type: 'tools',
                  results: scoredTools,
                  total_found: scoredTools.length,
                  available_count: scoredTools.filter(t => t.status === 'available').length,
                  message: tools && tools.length > 0 
                    ? `Found ${tools.length} tools matching "${args.search_term}"`
                    : `No tools found matching "${args.search_term}"`
                },
                timestamp: new Date().toISOString()
              };
              
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(result, null, 2)
                    }
                  ]
                }
              }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } catch (error) {
              console.error('Error in search_tools_assets:', error);
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: error.message }
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }

          if (name === 'get_organization_info') {
            try {
              // Get organization info for default organization
              const { data: org, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, is_active, created_at')
                .eq('id', DEFAULT_ORGANIZATION_ID)
                .single();

              if (orgError) {
                console.error('Error getting organization:', orgError);
                throw new Error('Organization not found');
              }

              // Get counts for default organization
              const { count: partsCount } = await supabase
                .from('parts')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', DEFAULT_ORGANIZATION_ID);

              const { count: toolsCount } = await supabase
                .from('tools')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', DEFAULT_ORGANIZATION_ID);

              const result = {
                success: true,
                data: {
                  organization: org,
                  inventory_summary: {
                    total_parts: partsCount || 0,
                    total_tools: toolsCount || 0
                  },
                  message: `Organization: ${org.name}`
                },
                timestamp: new Date().toISOString()
              };
              
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(result, null, 2)
                    }
                  ]
                }
              }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } catch (error) {
              console.error('Error in get_organization_info:', error);
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: error.message }
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }

          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown tool: ${name}` }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        default:
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    } catch (error) {
      console.error('❌ MCP Request handling failed:', error);
      
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { 
    status: 405, 
    headers: corsHeaders 
  });
});