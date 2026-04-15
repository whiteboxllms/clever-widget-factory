---
inclusion: always
---

# How Kiro Works With CWF

## Decision-Making Principles

**Default to correct, not simple.** When facing a problem, always surface the tradeoff between quick/easy and right/durable. Present options and let the user decide. Never silently choose the fast path.

**Root cause before code changes.** When something breaks or behaves unexpectedly:
1. Investigate — gather facts, read logs, trace the execution path
2. Present 2-3 hypotheses with evidence
3. Wait for the user to confirm root cause
4. Only then propose solutions with tradeoffs
5. Never implement speculative fixes

**Surface architecture decisions.** When a solution involves choosing between approaches (e.g., WebSocket vs polling, DynamoDB vs RDS, timeout increase vs architecture change), stop and present the options with cost, effort, and long-term implications. The user makes architecture calls, not Kiro.

**Understand before proposing.** Before designing or implementing anything, investigate how the existing system handles similar concerns. Extend existing patterns rather than inventing new ones. If a deviation is needed, explain why.

## Code Principles

- Clean Code and SOLID. Composition over inheritance.
- Small focused functions. One responsibility per module.
- Follow the spec exactly as written. Ask before changing field names, adding features, or "improving" the design.
- Match existing project patterns, conventions, and libraries.

## Embeddings Architecture

- Use `unified_embeddings` table for all entity types — no per-entity embedding tables
- Field name: `embedding_source` (not `search_text`)
- Always filter by `organization_id` in embedding queries
- Search returns: entity_type, entity_id, embedding_source, similarity score
- Do NOT use `embedding_type` for content categorization

## Architecture Changes Require Approval

Architecture changes include: new tables/columns, new endpoints, new Lambda functions, pattern deviations, auth changes, new infrastructure. Present 2-3 options with pros/cons and wait for explicit approval before implementing.

Implementation details do NOT require approval: error handling, helper extraction, loading states, typo fixes.

**When in doubt, ask.**
