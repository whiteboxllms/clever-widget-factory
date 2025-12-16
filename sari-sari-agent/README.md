# Sari Sari Agent

A cost-effective, extensible conversational AI system for self-serve farm stores.

## Project Structure

```
sari-sari-agent/
├── src/
│   ├── agent/           # Agent Core orchestration
│   ├── inventory/       # Inventory service and RDS integration
│   ├── pricing/         # Price calculator and negotiation engine
│   ├── nlp/            # NLP service with pluggable AI backends
│   ├── personality/     # Agent personality framework (future)
│   ├── database/        # Database services and migrations
│   ├── types/          # TypeScript interfaces and types
│   └── utils/          # Shared utilities
├── web/                # React frontend
├── lambda/             # AWS Lambda functions
├── database/           # Database migrations and backups
├── tests/              # Unit and property-based tests
├── docs/               # Documentation
└── scripts/            # Deployment and utility scripts
```

## MVP Features

- Text-based conversational AI agent
- Integration with existing RDS farm inventory
- Sellability controls for customer-facing products
- Basic pricing and product recommendations
- Customer tracking and session management
- Cost-optimized AWS architecture ($15-28/month)

## Getting Started

1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations (with backups)
4. Deploy Lambda functions
5. Start development server

## Database Safety

All database changes include:
- Logical backups before modifications
- Rollback procedures documented
- Verification of existing functionality
- Human approval at checkpoints