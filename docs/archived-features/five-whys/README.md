# 5 Whys Feature - Archived

**Status**: Temporarily Disabled  
**Date**: January 2025  
**Reason**: Migrating from OpenRouter to AWS Bedrock

## Overview

The 5 Whys Analysis feature has been temporarily disabled while we migrate from OpenRouter API to AWS Bedrock. This feature provided an AI-powered accountability coach that guided users through root cause analysis using the 5 Whys methodology.

## What Was Disabled

The following functionality has been stubbed out:

1. **UI Components**:
   - 5Ys button now shows "Coming Soon" toast message
   - Button is disabled with gray styling
   - All 5 Whys dialogs are commented out

2. **State Management**:
   - Session state variables commented out
   - Session checking logic disabled
   - Dialog visibility state removed

3. **API Calls**:
   - OpenRouter API integration disabled
   - Session management endpoints still exist but are not called from UI

## What Was Preserved

### Prompts
All AI prompts have been saved in `PROMPTS.md` for future Bedrock implementation. These include:
- Base prompt and core rules
- Stage-specific prompts (5 stages)
- Context management instructions
- Model configuration details

### Database Schema
The `five_whys_sessions` table remains intact with all existing data:
- Session history preserved
- Root cause analyses saved
- User associations maintained

### Backend Code
All backend code remains in place but is not actively used:
- `src/hooks/useFiveWhysAgent.tsx` - React hook for conversation flow
- `src/services/fiveWhysService.ts` - API service layer
- `src/components/FiveWhysDialog.tsx` - Main dialog component
- `src/components/FiveWhysSessionSelector.tsx` - Session selection UI
- `src/components/FiveWhysSessionViewer.tsx` - View past sessions
- `supabase/functions/mcp-server/tools/five-whys-chat.ts` - Edge function

## Changes Made

### GenericIssueCard.tsx
```typescript
// Before:
onClick={() => setShowFiveWhysSelector(true)}

// After:
onClick={() => {
  toast({
    title: "Coming Soon",
    description: "5 Whys Analysis will be available soon with AWS Bedrock integration.",
  });
}}
disabled
```

All imports and state related to 5 Whys have been commented out with clear markers.

## Future Implementation with AWS Bedrock

When re-implementing with Bedrock:

1. **Model Selection**:
   - Use Claude 3 Haiku or Sonnet via Bedrock
   - Consider streaming for better UX
   - Leverage Bedrock's built-in guardrails

2. **Architecture**:
   - Replace OpenRouter API calls with Bedrock SDK
   - Update edge function or create Lambda function
   - Maintain same conversation flow and prompts

3. **Cost Optimization**:
   - Bedrock pricing is more predictable
   - No API key management needed
   - Better integration with AWS infrastructure

4. **Re-enabling**:
   - Uncomment imports in GenericIssueCard.tsx
   - Restore state variables
   - Update API service to call Bedrock
   - Re-enable button and dialogs
   - Test conversation flow

## Testing Checklist (for re-implementation)

- [ ] Conversation flow works through all 5 stages
- [ ] Session saving and loading works
- [ ] Multiple choice options display correctly
- [ ] Custom input option works
- [ ] Session history is preserved
- [ ] Root cause summary is generated
- [ ] UI is responsive and accessible
- [ ] Error handling works properly
- [ ] Cost per conversation is acceptable

## Related Documentation

- `PROMPTS.md` - All AI prompts and configuration
- Main README.md - Project overview and migration status

## Contact

For questions about re-implementing this feature, refer to the prompts and code structure preserved in this directory.
