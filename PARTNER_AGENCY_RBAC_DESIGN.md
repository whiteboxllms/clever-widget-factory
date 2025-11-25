# Partner Agency Role-Based Access Control (RBAC) Design

## Overview

This document outlines the design for supporting partner agency access with role-based permissions. Partner agencies can access data relevant to specific partnerships while maintaining proper data isolation.

## Current Role System

### Existing Roles
- **superadmin**: Full system access across all organizations
- **admin**: Full access within their organization
- **leadership**: Strategic decision-making access
- **contributor**: Content creation and editing
- **viewer**: Read-only access

### Current Implementation
- Roles stored in `organization_members.role`
- Frontend checks: `isLeadership`, `isContributor`, `canEditTools`
- Lambda Authorizer returns single `organization_id` from user's primary membership

## Partner Agency Requirements

### Use Cases
1. **Partner Agency Users**: Users from external organizations who need access to shared data
2. **Partnership-Specific Data**: Missions, actions, tools, or inventory items tagged for partnership visibility
3. **Partner Roles**: Partner-specific roles (e.g., `partner_contributor`, `partner_viewer`) that grant limited access
4. **Data Filtering**: Partner users only see data explicitly shared with their partnership

### Example Scenarios
- **ATI Partnership**: Philippine Agricultural Training Institute users can view/edit missions and actions related to ATI collaboration
- **Multi-Agency Mission**: Multiple agencies collaborate on a mission; each agency's users see relevant data
- **Tool Sharing**: Tools loaned to partner agencies are visible to both organizations

## Database Schema

### New Tables

#### 1. `partner_organizations`
Defines partnerships between organizations.

```sql
CREATE TABLE partner_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_a_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  organization_b_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partnership_name VARCHAR(255), -- e.g., "ATI Partnership", "Joint Training Program"
  partnership_type VARCHAR(50) DEFAULT 'collaboration', -- 'collaboration', 'contract', 'mou'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'pending'
  created_by UUID REFERENCES organization_members(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_a_id, organization_b_id),
  CHECK (organization_a_id != organization_b_id)
);

CREATE INDEX idx_partner_orgs_org_a ON partner_organizations(organization_a_id);
CREATE INDEX idx_partner_orgs_org_b ON partner_organizations(organization_b_id);
CREATE INDEX idx_partner_orgs_status ON partner_organizations(status);
```

#### 2. `partner_members`
Assigns users to partnerships with specific roles.

```sql
CREATE TABLE partner_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_organization_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  cognito_user_id VARCHAR(255) NOT NULL, -- Cognito user ID
  organization_id UUID NOT NULL, -- User's home organization
  partner_organization_id UUID NOT NULL, -- Partner organization they're accessing
  role VARCHAR(50) NOT NULL, -- 'partner_admin', 'partner_contributor', 'partner_viewer'
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES organization_members(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_organization_id, cognito_user_id)
);

CREATE INDEX idx_partner_members_user ON partner_members(cognito_user_id, is_active);
CREATE INDEX idx_partner_members_partner_org ON partner_members(partner_organization_id);
```

#### 3. `partnership_data_tags`
Tags data (missions, actions, tools) as visible to specific partnerships.

```sql
CREATE TABLE partnership_data_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_organization_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL, -- 'mission', 'action', 'tool', 'part', 'issue'
  data_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_organization_id, data_type, data_id)
);

CREATE INDEX idx_partnership_tags_data ON partnership_data_tags(data_type, data_id);
CREATE INDEX idx_partnership_tags_partner ON partnership_data_tags(partner_organization_id);
```

### Partner Role Definitions

#### `partner_admin`
- Full access to partnership-tagged data
- Can invite other partner users
- Can tag/untag data for partnership
- Cannot access non-partnership data

#### `partner_contributor`
- Can view and edit partnership-tagged data
- Can create new data within partnership context
- Cannot tag data or manage partner users

#### `partner_viewer`
- Read-only access to partnership-tagged data
- Cannot create or edit

## Lambda Authorizer Updates

### Enhanced Context Variables

The authorizer should return:

```javascript
{
  organization_id: "primary-org-uuid", // User's home organization
  accessible_organization_ids: ["org-1", "org-2"], // Primary + partner orgs
  partner_access: [
    {
      partner_organization_id: "partner-org-uuid",
      role: "partner_contributor",
      organization_id: "partner-org-uuid" // The org they're accessing
    }
  ],
  is_superadmin: "true" | "false",
  user_role: "admin" | "leadership" | "contributor" | "viewer",
  cognito_user_id: "cognito-user-id"
}
```

### Updated Authorizer Query

```javascript
async function getUserOrganizationData(cognitoUserId) {
  const dbClient = new Client(dbConfig);
  
  try {
    await dbClient.connect();
    
    // Get primary organization membership
    const primaryQuery = `
      SELECT 
        om.organization_id,
        om.role,
        COALESCE(om.super_admin, false) as is_superadmin
      FROM organization_members om
      WHERE om.cognito_user_id = $1
        AND om.is_active = true
      ORDER BY om.created_at ASC
      LIMIT 1;
    `;
    
    const primaryResult = await dbClient.query(primaryQuery, [cognitoUserId]);
    
    if (primaryResult.rows.length === 0) {
      return null;
    }
    
    const primary = primaryResult.rows[0];
    
    // Get partner organization memberships
    const partnerQuery = `
      SELECT 
        po.id as partner_organization_id,
        po.organization_a_id,
        po.organization_b_id,
        pm.role as partner_role,
        CASE 
          WHEN po.organization_a_id = $2 THEN po.organization_b_id
          ELSE po.organization_a_id
        END as accessible_organization_id
      FROM partner_members pm
      JOIN partner_organizations po ON pm.partner_organization_id = po.id
      WHERE pm.cognito_user_id = $1
        AND pm.is_active = true
        AND po.status = 'active'
        AND (
          po.organization_a_id = $2 OR 
          po.organization_b_id = $2
        );
    `;
    
    const partnerResult = await dbClient.query(partnerQuery, [
      cognitoUserId,
      primary.organization_id
    ]);
    
    const partnerAccess = partnerResult.rows.map(row => ({
      partner_organization_id: row.partner_organization_id,
      role: row.partner_role,
      organization_id: row.accessible_organization_id
    }));
    
    // Build accessible organization IDs list
    const accessibleOrgIds = [
      primary.organization_id,
      ...partnerAccess.map(p => p.organization_id)
    ];
    
    return {
      organization_id: primary.organization_id,
      accessible_organization_ids: accessibleOrgIds,
      partner_access: partnerAccess,
      role: primary.role || 'member',
      is_superadmin: primary.is_superadmin || false
    };
  } finally {
    await dbClient.end();
  }
}
```

## Lambda Function Updates

### Data Filtering Pattern

All Lambda functions should filter data by accessible organizations:

```javascript
// Extract from authorizer context
const organizationId = event.requestContext.authorizer.organization_id;
const accessibleOrgIds = JSON.parse(
  event.requestContext.authorizer.accessible_organization_ids || '[]'
);
const partnerAccess = JSON.parse(
  event.requestContext.authorizer.partner_access || '[]'
);
const isSuperadmin = event.requestContext.authorizer.is_superadmin === 'true';

// Build WHERE clause
let whereConditions = [];

if (isSuperadmin) {
  // Superadmins see everything
  whereConditions = [];
} else {
  // Filter by accessible organizations
  const orgIdsList = accessibleOrgIds.map(id => `'${id}'`).join(',');
  whereConditions.push(`organization_id IN (${orgIdsList})`);
  
  // For partner users, also include partnership-tagged data
  if (partnerAccess.length > 0) {
    const partnerOrgIds = partnerAccess.map(p => p.partner_organization_id);
    const partnerIdsList = partnerOrgIds.map(id => `'${id}'`).join(',');
    
    whereConditions.push(`
      OR id IN (
        SELECT data_id 
        FROM partnership_data_tags 
        WHERE partner_organization_id IN (${partnerIdsList})
          AND data_type = 'mission' -- or 'action', 'tool', etc.
      )
    `);
  }
}

const whereClause = whereConditions.length > 0 
  ? `WHERE ${whereConditions.join(' OR ')}`
  : '';
```

### Permission Checks

```javascript
function canEditData(userRole, partnerAccess, dataOrganizationId, userOrganizationId, isSuperadmin) {
  if (isSuperadmin) return true;
  
  // Check primary organization permissions
  if (dataOrganizationId === userOrganizationId) {
    return ['admin', 'leadership', 'contributor'].includes(userRole);
  }
  
  // Check partner permissions
  const partnerAccess = partnerAccess.find(
    p => p.organization_id === dataOrganizationId
  );
  
  if (partnerAccess) {
    return ['partner_admin', 'partner_contributor'].includes(partnerAccess.role);
  }
  
  return false;
}
```

## Frontend Updates

### Updated useAuth Hook

```typescript
interface AuthContextType {
  user: User | null;
  organizationId: string | null;
  accessibleOrganizationIds: string[];
  partnerAccess: Array<{
    partner_organization_id: string;
    role: string;
    organization_id: string;
  }>;
  isSuperadmin: boolean;
  userRole: string;
  // ... existing fields
}
```

### Partner Data Filtering

Components should filter data based on accessible organizations:

```typescript
const { accessibleOrganizationIds, partnerAccess } = useAuth();

// Fetch missions accessible to user
const missions = await fetch(`${API_BASE_URL}/missions?organization_ids=${accessibleOrganizationIds.join(',')}`);
```

### Partner Role Checks

```typescript
function canEditMission(mission, userContext) {
  const { userRole, organizationId, partnerAccess, isSuperadmin } = userContext;
  
  if (isSuperadmin) return true;
  
  // Check if mission is in user's primary org
  if (mission.organization_id === organizationId) {
    return ['admin', 'leadership', 'contributor'].includes(userRole);
  }
  
  // Check partner access
  const partner = partnerAccess.find(
    p => p.organization_id === mission.organization_id
  );
  
  if (partner) {
    return ['partner_admin', 'partner_contributor'].includes(partner.role);
  }
  
  return false;
}
```

## API Endpoints

### New Endpoints

#### 1. Partner Organizations Management
```
GET    /api/partner_organizations
POST   /api/partner_organizations
PUT    /api/partner_organizations/{id}
DELETE /api/partner_organizations/{id}
```

#### 2. Partner Members Management
```
GET    /api/partner_members?partner_organization_id={id}
POST   /api/partner_members
PUT    /api/partner_members/{id}
DELETE /api/partner_members/{id}
```

#### 3. Partnership Data Tagging
```
GET    /api/partnership_tags?data_type={type}&data_id={id}
POST   /api/partnership_tags
DELETE /api/partnership_tags/{id}
```

## Migration Strategy

### Phase 1: Database Schema
1. Create new tables (`partner_organizations`, `partner_members`, `partnership_data_tags`)
2. Add indexes for performance
3. Create migration scripts

### Phase 2: Authorizer Updates
1. Update Lambda Authorizer to query partner memberships
2. Return enhanced context variables
3. Test with sample partner relationships

### Phase 3: Lambda Function Updates
1. Update all Lambda functions to use `accessible_organization_ids`
2. Add partnership data filtering
3. Add permission checks for partner roles

### Phase 4: Frontend Updates
1. Update `useAuth` hook to handle partner access
2. Update data fetching to use accessible org IDs
3. Add UI for managing partnerships (admin only)
4. Add UI for tagging data for partnerships

### Phase 5: Testing & Rollout
1. Create test partner organizations
2. Test partner user access
3. Test data isolation
4. Test permission boundaries

## Security Considerations

1. **Data Isolation**: Partner users can only access explicitly tagged data
2. **Role Hierarchy**: Partner roles are separate from primary org roles
3. **Audit Trail**: Log all partner data access
4. **Invitation System**: Partner members must be explicitly invited
5. **Superadmin Override**: Superadmins can access all data regardless of partnerships

## Cost Impact

- **Database**: Additional tables and indexes (minimal cost)
- **Lambda Authorizer**: Additional query for partner memberships (~50ms per request, cached)
- **Lambda Functions**: Slightly more complex WHERE clauses (negligible)
- **Total**: Minimal cost increase

## Future Enhancements

1. **Granular Permissions**: Per-partnership permission sets
2. **Data Sharing Rules**: Automatic tagging based on rules
3. **Partner Analytics**: Usage metrics per partnership
4. **Multi-Partner Access**: Data visible to multiple partnerships
5. **Partner-Specific Custom Fields**: Custom data fields per partnership

