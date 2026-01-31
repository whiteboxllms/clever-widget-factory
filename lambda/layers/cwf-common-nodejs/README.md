# CWF Common Layer

Shared utilities for Clever Widget Factory Lambda functions.

## Contents

- `lib/embedding-composition.js` - Embedding source composition utilities
- `lib/authorizerContext.js` - API Gateway authorizer context helpers
- `lib/response.js` - HTTP response helpers with CORS
- `lib/db.js` - PostgreSQL database query utilities

## Usage in Lambda

```javascript
// Import from layer
const { composePartEmbeddingSource } = require('/opt/nodejs/lib/embedding-composition');
const { getAuthorizerContext, buildOrganizationFilter } = require('/opt/nodejs/lib/authorizerContext');
const { success, error, corsResponse } = require('/opt/nodejs/lib/response');
const { query } = require('/opt/nodejs/lib/db');
```

## Deployment

```bash
./deploy-layer.sh
```

## Layer Structure

```
cwf-common-nodejs/
├── nodejs/
│   ├── lib/
│   │   ├── embedding-composition.js
│   │   ├── authorizerContext.js
│   │   ├── response.js
│   │   └── db.js
│   └── package.json
├── deploy-layer.sh
└── README.md
```

## Version History

- v1: Initial version with embedding-composition.js
- v2: Added authorizerContext.js, response.js, db.js
