# MCP Server API Documentation

## Overview

The Clever Widget Factory MCP Server provides standardized tools for AI agents to interact with the asset management and accountability system. It enables root cause analysis workflows, action creation, and resource management.

## Server Information

- **Name**: clever-widget-factory-mcp
- **Version**: 1.0.0
- **Protocol**: Model Context Protocol (MCP)
- **Transport**: Server-Sent Events (SSE)

## Authentication

The server uses Supabase service role authentication. All tool calls require:
- `organization_id`: UUID of the organization
- Optional `user_id`: For audit logging and user context

## Available Tools

### Issue Management Tools

#### `list_issues`
Query issues with filters (status, context_type, assigned_to, date range)

**Parameters:**
- `organization_id` (required): Organization UUID
- `status` (optional): Filter by issue status
- `context_type` (optional): Filter by context type (tool, order, inventory, facility)
- `assigned_to` (optional): Filter by assigned user UUID
- `date_from` (optional): Filter issues from this date (ISO 8601)
- `date_to` (optional): Filter issues to this date (ISO 8601)
- `limit` (optional): Maximum number of issues to return (1-100, default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "issues": [...],
    "count": 5,
    "filters_applied": {...},
    "summary": {...}
  }
}
```

#### `get_issue_details`
Get full issue details including history and related actions

**Parameters:**
- `issue_id` (required): Issue UUID
- `organization_id` (required): Organization UUID

#### `create_issue`
Create new issue with problem description and context

**Parameters:**
- `organization_id` (required): Organization UUID
- `context_id` (required): Asset/tool ID
- `context_type` (required): Context type (tool, order, inventory, facility)
- `description` (required): Issue description
- `reported_by` (required): User UUID who reported the issue
- `issue_type` (optional): Type of issue
- `is_misuse` (optional): Whether this is misuse (default: false)
- `report_photo_urls` (optional): Array of photo URLs
- `materials_needed` (optional): Materials needed for resolution

#### `update_issue_root_cause`
Update root cause analysis fields

**Parameters:**
- `issue_id` (required): Issue UUID
- `organization_id` (required): Organization UUID
- `root_cause` (optional): Root cause analysis
- `ai_analysis` (optional): AI analysis of the issue
- `next_steps` (optional): Recommended next steps
- `updated_by` (required): User UUID making the update

#### `update_issue_workflow`
Change workflow status and assignments

**Parameters:**
- `issue_id` (required): Issue UUID
- `organization_id` (required): Organization UUID
- `workflow_status` (required): New workflow status (reported, diagnosed, in_progress, completed)
- `assigned_to` (optional): User UUID to assign to
- `updated_by` (required): User UUID making the update

### Action Management Tools

#### `list_actions`
Query actions with filters

**Parameters:**
- `organization_id` (required): Organization UUID
- `status` (optional): Filter by action status
- `assigned_to` (optional): Filter by assigned user UUID
- `asset_id` (optional): Filter by asset UUID
- `mission_id` (optional): Filter by mission UUID
- `limit` (optional): Maximum number of actions to return (1-100, default: 20)

#### `get_action_details`
Get full action details including implementation updates

**Parameters:**
- `action_id` (required): Action UUID
- `organization_id` (required): Organization UUID

#### `create_action`
Create action item with assignments and requirements

**Parameters:**
- `organization_id` (required): Organization UUID
- `title` (required): Action title
- `description` (optional): Action description
- `assigned_to` (optional): User UUID to assign to
- `linked_issue_id` (optional): Related issue UUID
- `asset_id` (optional): Related asset UUID
- `status` (optional): Action status (default: pending)
- `required_stock` (optional): Required parts/materials (JSON object)
- `required_tools` (optional): Required tools (array of strings)
- `estimated_duration` (optional): Estimated duration
- `created_by` (required): User UUID creating the action

#### `update_action_status`
Update action status and completion details

**Parameters:**
- `action_id` (required): Action UUID
- `organization_id` (required): Organization UUID
- `status` (required): New action status
- `completed_at` (optional): Completion timestamp (ISO 8601)
- `actual_duration` (optional): Actual duration taken
- `observations` (optional): Completion observations
- `updated_by` (required): User UUID making the update

#### `add_action_update`
Add implementation update to action

**Parameters:**
- `action_id` (required): Action UUID
- `organization_id` (required): Organization UUID
- `update_text` (required): Update text
- `update_type` (optional): Type of update (default: progress)
- `updated_by` (required): User UUID making the update

### Inventory & Resource Tools

#### `query_parts_inventory`
Search parts/inventory with availability check

**Parameters:**
- `organization_id` (required): Organization UUID
- `search_term` (optional): Search term for part name/description
- `category` (optional): Filter by part category
- `min_quantity` (optional): Minimum quantity filter
- `storage_vicinity` (optional): Filter by storage vicinity
- `limit` (optional): Maximum number of parts to return (1-100, default: 20)

#### `get_part_details`
Get part details including stock levels, location, supplier

**Parameters:**
- `part_id` (required): Part UUID
- `organization_id` (required): Organization UUID

#### `check_parts_availability`
Validate if required parts are in stock

**Parameters:**
- `organization_id` (required): Organization UUID
- `required_parts` (required): Array of objects with `part_id` and `quantity`

### Asset/Tool Management Tools

#### `query_tools_assets`
Search tools/equipment with status and location

**Parameters:**
- `organization_id` (required): Organization UUID
- `search_term` (optional): Search term for tool name/description
- `category` (optional): Filter by tool category
- `status` (optional): Filter by tool status (available, checked_out, unavailable, needs_attention, under_repair, removed)
- `storage_location` (optional): Filter by storage location
- `limit` (optional): Maximum number of tools to return (1-100, default: 20)

#### `get_sop_for_asset`
Retrieve SOP documentation for asset

**Parameters:**
- `asset_id` (required): Asset UUID
- `organization_id` (required): Organization UUID

### Organization & Assignment Tools

#### `list_organization_members`
Get members with roles for assignment

**Parameters:**
- `organization_id` (required): Organization UUID
- `role` (optional): Filter by member role
- `is_active` (optional): Filter by active status (default: true)

#### `get_member_attributes`
Get worker skill attributes for matching

**Parameters:**
- `user_id` (required): User UUID
- `organization_id` (required): Organization UUID

### Root Cause Analysis Tools

#### `log_five_whys_step`
Log each step of 5 Whys analysis

**Parameters:**
- `issue_id` (required): Issue UUID
- `organization_id` (required): Organization UUID
- `step_number` (required): Step number (1-5)
- `question` (required): The "Why" question
- `answer` (required): The answer to the question
- `logged_by` (required): User UUID logging the step

#### `get_related_issues`
Find similar past issues for pattern detection

**Parameters:**
- `issue_id` (required): Issue UUID
- `organization_id` (required): Organization UUID
- `similarity_threshold` (optional): Minimum similarity score (0-1, default: 0.7)
- `limit` (optional): Maximum number of related issues to return (1-20, default: 5)

#### `suggest_responsible_party`
Analyze issue and suggest assignment based on roles/skills

**Parameters:**
- `issue_id` (required): Issue UUID
- `organization_id` (required): Organization UUID
- `context_type` (required): Context type (tool, order, inventory, facility)
- `required_skills` (optional): Required skills for resolution (array of strings)

## Error Handling

All tools return standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

Common error codes:
- `VALIDATION_ERROR`: Input validation failed
- `DATABASE_ERROR`: Database operation failed
- `NOT_FOUND`: Requested resource not found
- `UNAUTHORIZED`: Organization access denied

## Usage Examples

### 5 Whys Workflow

1. **Create Issue**: Use `create_issue` to log the problem
2. **Log Steps**: Use `log_five_whys_step` for each "Why" question
3. **Find Related Issues**: Use `get_related_issues` for pattern analysis
4. **Suggest Assignment**: Use `suggest_responsible_party` for assignment
5. **Create Actions**: Use `create_action` for corrective actions
6. **Check Resources**: Use `check_parts_availability` and `query_tools_assets`

### Resource Planning

1. **Query Inventory**: Use `query_parts_inventory` to find available parts
2. **Check Availability**: Use `check_parts_availability` for specific needs
3. **Get SOPs**: Use `get_sop_for_asset` for procedure documentation
4. **Find Tools**: Use `query_tools_assets` for available equipment

## Rate Limiting

The server implements basic rate limiting. If you encounter rate limit errors, wait a moment before retrying.

## Support

For issues or questions about the MCP server, please refer to the project documentation or contact the development team.
