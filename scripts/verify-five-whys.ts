/**
 * Script to verify that a 5 Why analysis was saved correctly for an issue
 * Usage: npx tsx scripts/verify-five-whys.ts "issue title"
 * 
 * Note: Requires tsx to be installed: npm install -D tsx
 * Or use: npx tsx scripts/verify-five-whys.ts "issue title"
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://oskwnlhuuxjfuwnjuavn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3dubGh1dXhqZnV3bmp1YXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMzNTgsImV4cCI6MjA2ODE5OTM1OH0.nWbYYTMu7BOQt8pSRVGBr8Iy3nvLfe40H1W_qpiVXAQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyFiveWhys(issueTitle: string) {
  console.log(`\n🔍 Searching for issue: "${issueTitle}"\n`);

  // Default organization ID (from the codebase)
  const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

  // Try multiple search strategies
  const searchTerms = [
    issueTitle,
    issueTitle.toLowerCase(),
    ...issueTitle.split(' ').filter(w => w.length > 3) // Individual significant words
  ];

  console.log('Trying different search strategies...\n');

  // Search for the issue by description (title) - try with organization filter
  let { data: issues, error: issueError } = await supabase
    .from('issues')
    .select('*')
    .ilike('description', `%${issueTitle}%`)
    .eq('organization_id', DEFAULT_ORG_ID)
    .order('reported_at', { ascending: false })
    .limit(20);

  // If no results, try without org filter (might work if RLS allows)
  if ((!issues || issues.length === 0) && issueError) {
    console.log('Retrying without organization filter...\n');
    const retryResult = await supabase
      .from('issues')
      .select('*')
      .ilike('description', `%water%`)
      .order('reported_at', { ascending: false })
      .limit(20);
    issues = retryResult.data;
    issueError = retryResult.error;
  }
  
  // Also try searching for "water" or "faucet" separately
  if ((!issues || issues.length === 0) && !issueError) {
    console.log('Trying broader search for "water"...\n');
    const waterResult = await supabase
      .from('issues')
      .select('*')
      .ilike('description', `%water%`)
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('reported_at', { ascending: false })
      .limit(20);
    if (waterResult.data && waterResult.data.length > 0) {
      issues = waterResult.data;
      console.log(`Found ${issues.length} issue(s) containing "water". Showing all:\n`);
    }
  }

  if (issueError) {
    console.error('❌ Error fetching issues:', issueError);
    return;
  }

  if (!issues || issues.length === 0) {
    console.log('❌ No issues found matching that title.');
    return;
  }

  console.log(`✅ Found ${issues.length} issue(s):\n`);

  for (const issue of issues) {
    console.log(`\n📋 Issue: ${issue.description}`);
    console.log(`   ID: ${issue.id}`);
    console.log(`   Status: ${issue.status}`);
    console.log(`   Reported: ${new Date(issue.reported_at).toLocaleString()}`);
    console.log(`   Organization ID: ${issue.organization_id}`);

    // Check for five_whys_sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('five_whys_sessions')
      .select('*')
      .eq('issue_id', issue.id)
      .order('created_at', { ascending: false });

    if (sessionError) {
      console.log(`   ❌ Error fetching sessions: ${sessionError.message}`);
      continue;
    }

    if (!sessions || sessions.length === 0) {
      console.log(`   ⚠️  No 5 Whys sessions found for this issue.`);
    } else {
      console.log(`   ✅ Found ${sessions.length} 5 Whys session(s):`);
      for (const session of sessions) {
        console.log(`\n      Session ID: ${session.id}`);
        console.log(`      Status: ${session.status}`);
        console.log(`      Created: ${new Date(session.created_at).toLocaleString()}`);
        console.log(`      Updated: ${new Date(session.updated_at).toLocaleString()}`);
        
        if (session.root_cause_analysis) {
          console.log(`      ✅ Root Cause Analysis: Present`);
          console.log(`         Preview: ${session.root_cause_analysis.substring(0, 100)}...`);
        } else {
          console.log(`      ⚠️  Root Cause Analysis: Not yet completed`);
        }

        if (session.conversation_history && Array.isArray(session.conversation_history)) {
          console.log(`      ✅ Conversation History: ${session.conversation_history.length} messages`);
          
          // Show summary of conversation
          const assistantMessages = session.conversation_history.filter(
            (msg: any) => msg.role === 'assistant'
          );
          const userMessages = session.conversation_history.filter(
            (msg: any) => msg.role === 'user'
          );
          
          console.log(`         - ${assistantMessages.length} assistant messages`);
          console.log(`         - ${userMessages.length} user messages`);
          
          // Count "Why" questions
          const whyQuestions = assistantMessages.filter((msg: any) => 
            msg.content && /why\s+#?\d+/i.test(msg.content)
          );
          console.log(`         - ${whyQuestions.length} "Why" questions found`);
          
          if (whyQuestions.length > 0) {
            console.log(`\n         Why Questions:`);
            whyQuestions.forEach((msg: any, idx: number) => {
              const match = msg.content.match(/why\s+#?(\d+)/i);
              const whyNum = match ? match[1] : '?';
              const preview = msg.content.substring(0, 80).replace(/\n/g, ' ');
              console.log(`           ${whyNum}. ${preview}...`);
            });
          }
        } else {
          console.log(`      ⚠️  Conversation History: Empty or invalid`);
        }
      }
    }

    // Check ai_analysis field for five_whys data
    if (issue.ai_analysis) {
      try {
        const analysis = typeof issue.ai_analysis === 'string' 
          ? JSON.parse(issue.ai_analysis) 
          : issue.ai_analysis;
        
        if (analysis.five_whys) {
          console.log(`\n   ✅ AI Analysis contains five_whys data:`);
          const steps = Object.keys(analysis.five_whys).length;
          console.log(`      - ${steps} five_whys steps recorded`);
          
          Object.entries(analysis.five_whys).forEach(([key, value]: [string, any]) => {
            console.log(`      - ${key}: Q: ${value.question?.substring(0, 60)}...`);
            console.log(`              A: ${value.answer?.substring(0, 60)}...`);
          });
        } else {
          console.log(`   ℹ️  AI Analysis present but no five_whys data`);
        }
      } catch (e) {
        console.log(`   ⚠️  Could not parse ai_analysis: ${e}`);
      }
    } else {
      console.log(`   ℹ️  No AI analysis data in issue record`);
    }
  }

  console.log('\n');
}

// Get issue title from command line or use default
const issueTitle = process.argv[2] || "There is no water at the guest house faucet";

verifyFiveWhys(issueTitle).catch(console.error);
