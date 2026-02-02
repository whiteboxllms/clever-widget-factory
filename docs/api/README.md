# API Documentation

## OpenAPI Specification

The complete API specification is available in `openapi.yaml` (OpenAPI 3.0 format).

**56 endpoints documented** including:
- Actions, Missions, Issues
- Tools, Parts, Checkouts
- Explorations, Policies
- Analysis/Scoring
- Semantic Search
- Organization Management

## View Interactive Docs

### Online Viewers

**Swagger Editor (Recommended):**
https://editor.swagger.io/
- Paste contents of `openapi.yaml`
- Interactive API explorer
- Try out endpoints

**Redoc:**
https://redocly.github.io/redoc/
- Upload `openapi.yaml`
- Clean, readable documentation

**GitHub (if public repo):**
https://editor.swagger.io/?url=https://raw.githubusercontent.com/YOUR_ORG/clever-widget-factory/main/docs/api/openapi.yaml

### Local Viewers

**VS Code Extension:**
Install "OpenAPI (Swagger) Editor" extension
- Open `openapi.yaml` in VS Code
- Preview pane shows interactive docs

**Swagger UI (Docker):**
```bash
docker run -p 8080:8080 -e SWAGGER_JSON=/api/openapi.yaml -v $(pwd)/docs/api:/api swaggerapi/swagger-ui
# Open http://localhost:8080
```

## Update API Spec

Export latest from AWS API Gateway:

```bash
aws apigateway get-export \
  --rest-api-id 0720au267k \
  --stage-name prod \
  --export-type oas30 \
  --accepts application/yaml \
  --region us-west-2 \
  docs/api/openapi.yaml
```

## API Base URL

**Production:** `https://0720au267k.execute-api.us-west-2.amazonaws.com/prod`

## Authentication

All endpoints (except `/api/health`) require JWT token from AWS Cognito:

```
Authorization: Bearer <token>
```

## Key Endpoints

- `GET /api/actions` - List actions
- `GET /api/tools` - List tools
- `GET /api/parts` - List parts
- `POST /api/semantic-search` - Semantic search
- `POST /api/explorations` - Create exploration
- `POST /api/analysis/analyses` - Create analysis with scores

See `openapi.yaml` for complete details.
