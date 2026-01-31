# Product Overview

Clever Widget Factory (CWF) is an asset management and accountability system for tracking tools, parts, and work activities in a farm/workshop environment.

## Core Features

- **Asset Management**: Track 800+ tools and 850+ parts with checkout/return workflows
- **Action Tracking**: Document work activities with photos, descriptions, and accountability metrics
- **Issue Management**: Report and track problems with tools, parts, and orders
- **Mission Planning**: Organize work into missions with structured action blocks
- **Exploration System**: Data collection workflow for field observations and policy creation
- **Semantic Search**: AI-powered cross-entity search using unified embeddings (parts, tools, actions, issues, policies)
- **Sari-Sari Store**: E-commerce interface for selling parts inventory with health-focused recommendations

## Key Concepts

- **Actions**: Individual work activities with photos, descriptions, and accountability scores
- **Explorations**: Field observations that can be promoted to organizational policies
- **Checkouts**: Tool lending system with expected return dates and usage tracking
- **Policies**: Organizational standards derived from exploration data
- **Organization-based**: Multi-tenant system with organization-scoped data access

## User Roles

- Organization members with varying permissions (data:read:all, data:write:all, etc.)
- Authentication via AWS Cognito
- Authorization via Lambda authorizer with organization context

## Existing System Awareness

- Before proposing a new design or implementation, always inspect the existing code and specs.
- For any new endpoint or feature:
  - Identify existing modules, handlers, and data models that are closest to the requested behavior.
  - Prefer extending existing patterns over inventing new ones.
- When working in spec mode (requirements/design/tasks):
  - Cross-check the plan against current code to avoid contradicting existing flows and constraints.
  - Call out mismatches between spec and implementation and propose how to reconcile them (update code vs. update spec).
- If an aspect of code does not make sense, 
  - Ask questions before making changes.
  - Assume there's a reason for the current implementation.
  - Look for related code or documentation that might explain the design choice.
- Prefer extending existing patterns over inventing new ones.
- Call out mismatches between spec and implementation and propose how to reconcile them.
Identify existing modules, handlers, and data models that are closest to the requested behavior.


## Unified Embeddings System

The system uses a unified embeddings architecture to enable powerful cross-entity search and AI capabilities:

### What It Enables

1. **Cross-Entity Search**: Search across parts, tools, actions, issues, and policies in a single query
   - Example: "banana wine" finds the product, actions where it was made, issues during fermentation, and related policies

2. **Certification Evidence**: Gather proof of organic farming practices across all entity types
   - Example: "organic farming" finds policies (no synthetic pesticides), actions (compost applications), materials (organic neem oil), and experiments (companion planting)

3. **Enhanced Recommendations**: Product suggestions based on health outcomes and use cases
   - Example: "better sleep" finds banana wine (tryptophan), chamomile (relaxation), and actions about quiet hours

4. **Institutional Memory**: Make farm knowledge searchable
   - Past experiments (explorations)
   - Lessons learned (policies)
   - Problems solved (issues)
   - Work done (actions)
   - Resources available (parts/tools)

### How It Works

When entities are created or updated, the system:
1. Composes rich natural language descriptions from entity fields
2. Generates embedding vectors using AWS Bedrock
3. Stores both text and vectors in unified_embeddings table
4. Enables semantic search across all entity types

### User Experience

Users can:
- Search naturally: "I need something for better sleep"
- Find evidence: "Show me proof of organic practices"
- Discover connections: "What do we know about banana wine?"
- Get context: Results include entity type, relevance, and source text

See `.kiro/specs/unified-embeddings-system/` for technical details.
