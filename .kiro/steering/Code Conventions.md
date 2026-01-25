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

## Implementation Expectations for Kiro

When responding to requests:

1. First, restate your understanding of the change in terms of architecture and domain concepts.
2. Identify existing modules/classes that should be extended rather than creating new ones.
3. Propose a brief design sketch (responsibilities, inputs/outputs, error handling).
4. Only then write code that:
   - Respects module boundaries and naming conventions.
   - Includes minimal but meaningful tests.
   - Documents any tradeoffs or TODOs.
