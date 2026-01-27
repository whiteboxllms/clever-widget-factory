---
inclusion: always
---
<!------------------------------------------------------------------------------------
   Add rules to this file or a short description and have Kiro refine them for you.
   
   Learn about inclusion modes: https://kiro.dev/docs/steering/#inclusion-modes
-------------------------------------------------------------------------------------> 
# Code Conventions for CWF

## Design Principles

- Follow Clean Code and SOLID principles.
- Prefer composition over inheritance; inject dependencies explicitly.
- Keep functions small and focused; one clear responsibility per function/module.
- Avoid leaking persistence or transport concerns into domain logic.

## Architecture

- Treat CWF as a domain-driven system:
  - Model Actions, Explorations, Checkouts, Policies, and Organizations as explicit domain concepts.
  - Keep organization-based multi-tenancy concerns at the boundary (authn/z, data filters), not scattered through domain logic.
- Keep AWS-specific details (Cognito, Lambda authorizer, Bedrock calls) in infrastructure/adapters, not in core domain code.

## Embeddings Architecture Conventions

### Unified Embeddings Table Pattern

- **Use unified_embeddings table** for all entity types (parts, tools, actions, issues, policies)
- **Do NOT create per-entity embedding tables** (e.g., part_embedding, tool_embedding)
- **Rationale**: Enables cross-entity semantic search in a single query, simplifies maintenance, supports certification evidence gathering

### Embedding Source Composition

- **Field name**: Use `embedding_source` (not `search_text`) for the text used to generate embeddings
- **Composition**: Concatenate relevant fields with natural language (name + description + policy)
- **Avoid**: Categorical labels, codes, or structured data that doesn't add semantic meaning
- **Example**: `"Banana Wine. Fermented banana beverage. Rich in potassium and B vitamins. May support heart health and energy levels."`

### No Embedding Type Categorization

- **Do NOT use embedding_type** to categorize content (e.g., "general" vs "health_outcomes")
- **Rationale**: Semantic overlap makes categorization harmful (e.g., "energy" is both general and health-related)
- **Use embedding_type ONLY for**: Tracking source text composition strategy or model version experiments

### Search Result Pattern

- **Return**: entity_type, entity_id, embedding_source, similarity score
- **Do NOT duplicate**: Entity data from source tables
- **Frontend responsibility**: Fetch full entity details via entity_id from appropriate endpoint
- **Rationale**: Avoids data duplication, ensures consistency with source tables

### Multi-Tenancy

- **Always filter by organization_id** in embedding queries
- **Store organization_id** in unified_embeddings table with foreign key constraint
- **Cascade delete**: When organization or entity is deleted, embeddings are automatically deleted

## Implementation Expectations for Kiro

When responding to requests:

1. First, restate your understanding of the change in terms of architecture and domain concepts.
2. Identify existing modules/classes that should be extended rather than creating new ones.
3. Propose a brief design sketch (responsibilities, inputs/outputs, error handling).
4. **STOP and get explicit user approval before implementing** if the design involves:
   - New field names, column names, or data structures
   - Changes to composition strategies or field ordering
   - New embedding types or categorization schemes
   - Any deviation from existing patterns
   - Architectural decisions not explicitly specified in requirements
5. **When asking design questions:**
   - Research and present industry best practices
   - Analyze the existing codebase patterns
   - Provide 2-3 concrete options with pros/cons
   - Recommend the option that best balances best practices with existing patterns
   - Explain the reasoning behind the recommendation
6. Only then write code that:
   - Respects module boundaries and naming conventions.
   - Includes minimal but meaningful tests.
   - Documents any tradeoffs or TODOs.

## Database Migration Protocol

**All database changes MUST follow this two-step process:**

1. **Execute the migration** via Lambda:
   ```bash
   cat migrations/your-migration.sql | jq -Rs '{sql: .}' | \
   aws lambda invoke \
     --function-name cwf-db-migration \
     --payload file:///dev/stdin \
     --region us-west-2 \
     --cli-binary-format raw-in-base64-out \
     response.json && cat response.json
   ```

2. **Verify the changes** with a separate query:
   ```bash
   # For schema changes (columns, constraints, etc.)
   echo '{"sql": "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '\''your_table'\'' ORDER BY ordinal_position;"}' | \
   aws lambda invoke \
     --function-name cwf-db-migration \
     --payload file:///dev/stdin \
     --region us-west-2 \
     --cli-binary-format raw-in-base64-out \
     response.json && cat response.json | jq -r '.body' | jq
   
   # For constraints
   echo '{"sql": "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = '\''your_table'\''::regclass;"}' | \
   aws lambda invoke \
     --function-name cwf-db-migration \
     --payload file:///dev/stdin \
     --region us-west-2 \
     --cli-binary-format raw-in-base64-out \
     response.json && cat response.json | jq -r '.body' | jq
   ```

**Never assume a migration succeeded without verification.**

## CRITICAL: Architecture Change Approval

**ALL architecture changes require explicit user approval BEFORE implementation.**

### What Qualifies as an Architecture Change:

Architecture changes include ANY of the following:

1. **Data Structure Changes**
   - New database tables or columns
   - Changes to field names or types
   - New indexes or constraints
   - Changes to data relationships (foreign keys, joins)

2. **API/Interface Changes**
   - New API endpoints
   - Changes to request/response formats
   - New Lambda functions
   - Changes to authentication/authorization

3. **Pattern Deviations**
   - Using a different state management approach
   - Introducing new libraries or frameworks
   - Changing how errors are handled
   - New caching strategies

4. **Cross-Cutting Concerns**
   - Changes to logging, monitoring, or observability
   - Security model changes
   - Performance optimization strategies
   - Multi-tenancy implementation changes

### Architecture Change Protocol:

1. **IDENTIFY the change as architectural**
   - State clearly: "This requires an architecture change"
   - Explain what aspect of the architecture will change

2. **DOCUMENT current architecture**
   - Describe how the system currently works
   - Explain why the current approach exists
   - Identify what will break or change

3. **PROPOSE alternatives (2-3 options)**
   - Option A: [Description] - Pros: [...] - Cons: [...]
   - Option B: [Description] - Pros: [...] - Cons: [...]
   - Option C: [Description] - Pros: [...] - Cons: [...]
   - Recommend one option with clear reasoning

4. **WAIT for explicit approval**
   - **DO NOT implement** until user approves
   - User must explicitly say "proceed with Option X"
   - If user is unsure, provide more analysis

5. **DOCUMENT the decision**
   - Record why this approach was chosen
   - Note any trade-offs or future considerations
   - Update relevant documentation

### Examples of Architecture Changes:

**Requires Approval:**
- "We need to add a new `observations` field to the actions table"
- "Should we fetch observations from implementation_updates or aggregate in SQL?"
- "I'll create a new Lambda function for action scoring"
- "Let's convert useScoringPrompts to use TanStack Query"

**Does NOT Require Approval (implementation details):**
- "I'll add error handling to this function"
- "I'll extract this logic into a helper function"
- "I'll add a loading state to this component"
- "I'll fix this typo in the variable name"

**When in doubt, ask for approval.**

## CRITICAL: Design Decision Authority

**Kiro is NOT authorized to make design decisions independently.**

When implementing features:
- **Follow the spec exactly as written** - do not interpret, extend, or "improve" the design
- **Ask before changing field names** - even if they seem inconsistent with existing patterns
- **Ask before reordering fields** - composition order may have semantic significance
- **Ask before adding features** - even if they seem obviously useful
- **Ask before making "improvements"** - what seems like an improvement may break intended behavior

If the spec is unclear, incomplete, or seems wrong:
- **STOP implementation**
- **Ask specific questions** about the unclear aspects
- **Wait for explicit direction** before proceeding

Examples of decisions that require user approval:
- "Should I use 'state_transition' or 'action_existing_state' as the embedding_type value?"
- "Should observations come before or after policy in the composition?"
- "Should we filter inline column writes to only 'general' type?"
- "Should the default embedding_type be 'general' or NULL?"

**Never assume. Always ask.**

## CRITICAL: Root Cause Identification

**NO CODE CHANGES until root cause is identified, documented, and approved by user.**

### The Root Cause Rule:

**Errors are often caught during root cause analysis. Until root cause is agreed upon, there should be NO code changes.**

This is the most important rule in the codebase. Many bugs are actually symptoms of deeper issues, and fixing symptoms creates technical debt.

### Investigation Process:

1. **GATHER FACTS FIRST**
   - Ask user for specific symptoms, error messages, console logs
   - Ask what they were doing when the bug occurred
   - Ask if they can reproduce it consistently
   - Ask about environment (mobile vs desktop, browser, etc.)
   - **DO NOT proceed without concrete facts**

2. **ANALYZE WITHOUT ASSUMING**
   - Read existing code to understand current behavior
   - Trace the execution path based on reported symptoms
   - Identify multiple possible causes
   - **DO NOT assume you know the cause**
   - Look for similar patterns in the codebase

3. **DOCUMENT ROOT CAUSE HYPOTHESES**
   - Present 2-3 possible root causes with evidence for each
   - Explain why each hypothesis could explain the symptoms
   - Suggest specific tests to validate each hypothesis
   - **Format**: "Root Cause Hypothesis A: [description] - Evidence: [what supports this]"

4. **WAIT FOR ROOT CAUSE AGREEMENT**
   - Present findings to user
   - Discuss which hypothesis is most likely
   - **STOP and WAIT for user to confirm root cause**
   - Only proceed when user explicitly agrees on the root cause

5. **PROPOSE SOLUTION (only after root cause confirmed)**
   - Explain how the solution addresses the confirmed root cause
   - Discuss trade-offs and alternatives
   - **WAIT for user approval** before implementing
   - Confirm the solution won't introduce new issues

### What NOT to Do:

- ❌ **DO NOT make assumptions** about what the user is doing wrong
- ❌ **DO NOT implement speculative fixes** without confirming root cause
- ❌ **DO NOT modify shared components** (like ui/dialog.tsx) without discussion
- ❌ **DO NOT add complex workarounds** before understanding the real issue
- ❌ **DO NOT make multiple changes at once** - one hypothesis at a time

### Example of WRONG approach:
```
User: "Dialog closes during upload on mobile"
Kiro: *Assumes user is clicking X button*
Kiro: *Modifies dialog component to hide X button*
Kiro: *Adds onInteractOutside handlers*
Kiro: *Changes multiple files*
```

### Example of CORRECT approach:
```
User: "Dialog closes during upload on mobile"
Kiro: "Let me investigate. Can you check:
  1. Browser console for any errors or logs?
  2. Does it happen immediately or after a delay?
  3. Do you see any toast messages?
  
I see several possible causes:
  A. State update race condition
  B. Navigation triggered by URL change
  C. Browser back button behavior
  
Can you help me narrow this down?"
```

**ALWAYS investigate thoroughly before implementing. One careful fix is better than ten speculative changes.**
