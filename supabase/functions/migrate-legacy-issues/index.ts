import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Tool {
  id: string
  name: string
  known_issues: string | null
  created_at: string
}

interface ParsedIssue {
  description: string
  issue_type: 'safety' | 'efficiency' | 'cosmetic' | 'maintenance'
  blocks_checkout: boolean
  damage_assessment?: string
}

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { dryRun = true } = await req.json()

    console.log(`Starting migration in ${dryRun ? 'DRY RUN' : 'LIVE'} mode`)

    // Fetch tools with legacy known_issues
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, name, known_issues, created_at')
      .not('known_issues', 'is', null)
      .neq('known_issues', '')

    if (toolsError) {
      throw new Error(`Failed to fetch tools: ${toolsError.message}`)
    }

    const results = {
      totalTools: tools.length,
      processedTools: 0,
      skippedTools: 0,
      migratedIssues: 0,
      skippedIssues: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    for (const tool of tools) {
      try {
        const parsedIssues = parseKnownIssues(tool.known_issues!)
        
        if (parsedIssues.length === 0) {
          results.skippedTools++
          results.details.push({
            tool: tool.name,
            action: 'skipped',
            reason: 'No valid issues found',
            originalText: tool.known_issues
          })
          continue
        }

        results.processedTools++
        
        for (const issue of parsedIssues) {
          if (!dryRun) {
            // Insert the issue
            const { data: insertedIssue, error: insertError } = await supabase
              .from('tool_issues')
              .insert({
                tool_id: tool.id,
                description: issue.description,
                issue_type: issue.issue_type,
                blocks_checkout: issue.blocks_checkout,
                damage_assessment: issue.damage_assessment,
                reported_by: SYSTEM_USER_ID,
                reported_at: tool.created_at,
                status: 'active'
              })
              .select()
              .single()

            if (insertError) {
              results.errors.push(`Failed to insert issue for ${tool.name}: ${insertError.message}`)
              continue
            }

            // Create history record
            await supabase
              .from('tool_issue_history')
              .insert({
                issue_id: insertedIssue.id,
                old_status: null,
                new_status: 'active',
                changed_by: SYSTEM_USER_ID,
                notes: 'Migrated from legacy known_issues field'
              })
          }

          results.migratedIssues++
          results.details.push({
            tool: tool.name,
            action: 'migrated',
            issue: {
              description: issue.description,
              type: issue.issue_type,
              blocksCheckout: issue.blocks_checkout,
              originalText: tool.known_issues
            }
          })
        }

      } catch (error) {
        results.errors.push(`Error processing tool ${tool.name}: ${error.message}`)
      }
    }

    console.log('Migration completed:', results)

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Migration error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function parseKnownIssues(knownIssues: string): ParsedIssue[] {
  if (!knownIssues || knownIssues.trim() === '') {
    return []
  }

  const cleaned = knownIssues.trim()
  
  // Skip non-issues
  if (cleaned.toLowerCase() === 'no' || 
      cleaned.toLowerCase() === 'none' ||
      cleaned.toLowerCase().startsWith('tool removed')) {
    return []
  }

  // Split by newlines and process each line
  const lines = cleaned.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const issues: ParsedIssue[] = []

  for (const line of lines) {
    // Skip non-issue lines
    if (line.toLowerCase() === 'no' || 
        line.toLowerCase() === 'none' ||
        line.toLowerCase().startsWith('tool removed')) {
      continue
    }

    const issue = classifyIssue(line)
    if (issue) {
      issues.push(issue)
    }
  }

  return issues
}

function classifyIssue(description: string): ParsedIssue | null {
  const lower = description.toLowerCase()
  
  // Safety keywords
  const safetyKeywords = ['rust', 'rusty', 'broken', 'melted', 'damaged', 'cracked', 'sharp', 'dangerous']
  // Maintenance keywords  
  const maintenanceKeywords = ['loose', 'missing', 'bolt', 'lock', 'screw', 'needs', 'replace', 'fix']
  // Efficiency keywords
  const efficiencyKeywords = ['only dirt', 'might be broken', 'slow', 'stuck', 'hard to', 'difficult']
  
  // Blocking keywords (severe issues)
  const blockingKeywords = ['broken', 'melted', 'missing', 'might be broken', 'doesn\'t work', 'not working']

  let issueType: 'safety' | 'efficiency' | 'cosmetic' | 'maintenance' = 'cosmetic'
  let blocksCheckout = false
  let damageAssessment: string | undefined

  // Classify issue type
  if (safetyKeywords.some(keyword => lower.includes(keyword))) {
    issueType = 'safety'
    damageAssessment = description
  } else if (maintenanceKeywords.some(keyword => lower.includes(keyword))) {
    issueType = 'maintenance'
  } else if (efficiencyKeywords.some(keyword => lower.includes(keyword))) {
    issueType = 'efficiency'
  }

  // Check if it blocks checkout
  if (blockingKeywords.some(keyword => lower.includes(keyword))) {
    blocksCheckout = true
  }

  return {
    description: description.trim(),
    issue_type: issueType,
    blocks_checkout: blocksCheckout,
    damage_assessment: damageAssessment
  }
}