# Maxwell - CWF's Organizational Intelligence Assistant

Maxwell is a Bedrock Agent that helps organization members understand the history and condition of their assets by analyzing recorded observations.

## Architecture

Maxwell consists of three main components:

1. **Bedrock Agent** (Agent ID: `CNV04Q1OAZ`)
   - Foundation model: Claude 3.5 Haiku
   - Instruction file: `lambda/maxwell-chat/maxwell-instruction.txt`
   - Role: Synthesis tool that presents findings objectively without judgment

2. **Lambda Function** (`cwf-maxwell-chat`)
   - Handles chat requests from the frontend
   - Injects entity context into user messages
   - Manages session state and trace logging
   - Location: `lambda/maxwell-chat/index.js`

3. **Tool Lambda** (`cwf-maxwell-observations`)
   - Retrieves observations for entities (tools, parts, actions)
   - Reads entity context from session attributes
   - Location: `lambda/maxwell-observations/index.js`

## Key Design Principles

### Non-Judgmental Synthesis
Maxwell is designed as a **synthesis tool, not a decision-maker**:
- Presents findings objectively without judgment
- Uses "Entropy Reducing Options" instead of "Recommended Next Steps"
- Avoids prescriptive language ("you should", "must", "need to")
- Uses descriptive language ("observed patterns suggest", "data indicates", "options include")

### Entity Context Injection
The `cwf-maxwell-chat` Lambda automatically injects entity context into user messages:
```javascript
const contextPrefix = `[Context: You are discussing ${entityType} "${entityName}" (ID: ${entityId})] `;
enhancedMessage = contextPrefix + message;
```

This solves the Bedrock Agent limitation where session attributes aren't visible to the Agent's reasoning process.

## Agent Versioning & Deployment

### Understanding Bedrock Agent Versions

Bedrock Agents use a version system:
- **DRAFT**: Working version that can be modified
- **Numbered versions** (1, 2, 3, etc.): Immutable snapshots
- **Aliases**: Pointers to specific versions

**Critical insight**: Aliases cannot point to DRAFT. They must point to numbered versions.

### How to Create a New Version

**The key discovery**: Creating an alias automatically creates a numbered version from DRAFT.

```bash
# 1. Update the agent instruction
aws bedrock-agent update-agent \
  --agent-id CNV04Q1OAZ \
  --agent-name Maxwell \
  --foundation-model "anthropic.claude-3-5-haiku-20241022-v1:0" \
  --agent-resource-role-arn "arn:aws:iam::131745734428:role/maxwell-bedrock-agent-role" \
  --instruction "$(cat lambda/maxwell-chat/maxwell-instruction.txt)" \
  --region us-west-2

# 2. Prepare the DRAFT version
aws bedrock-agent prepare-agent \
  --agent-id CNV04Q1OAZ \
  --region us-west-2

# 3. Wait for preparation to complete
sleep 5
aws bedrock-agent get-agent \
  --agent-id CNV04Q1OAZ \
  --region us-west-2 \
  --query 'agent.agentStatus'

# 4. Create a new alias (this automatically creates a numbered version!)
aws bedrock-agent create-agent-alias \
  --agent-id CNV04Q1OAZ \
  --agent-alias-name "version-X-alias" \
  --description "Description of changes" \
  --region us-west-2

# 5. Verify the new version was created
aws bedrock-agent list-agent-versions \
  --agent-id CNV04Q1OAZ \
  --region us-west-2

# 6. Update production alias to point to new version
aws bedrock-agent update-agent-alias \
  --agent-id CNV04Q1OAZ \
  --agent-alias-id EOLN5DJPW4 \
  --agent-alias-name "production" \
  --routing-configuration agentVersion=X \
  --region us-west-2
```

### Current Configuration

- **Agent ID**: `CNV04Q1OAZ`
- **Production Alias**: `EOLN5DJPW4` (points to version 4)
- **Test Alias**: `SAQTOMS0IS` (points to version 3)
- **Lambda Alias**: Production (`EOLN5DJPW4`)

## Deployment Process

### Updating Maxwell's Instruction

1. Edit `lambda/maxwell-chat/maxwell-instruction.txt`
2. Run the version creation process (see above)
3. No Lambda redeployment needed

### Updating Lambda Code

```bash
# Package the Lambda
cd lambda/maxwell-chat
zip -r /tmp/maxwell-chat.zip index.js package.json

# Deploy
aws lambda update-function-code \
  --function-name cwf-maxwell-chat \
  --zip-file fileb:///tmp/maxwell-chat.zip \
  --region us-west-2
```

### Updating Tool Lambda

```bash
# Package the Lambda
cd lambda/maxwell-observations
zip -r /tmp/maxwell-observations.zip index.js package.json

# Deploy
aws lambda update-function-code \
  --function-name cwf-maxwell-observations \
  --zip-file fileb:///tmp/maxwell-observations.zip \
  --region us-west-2
```

## Testing

### Enable Trace Logging

Trace logging is enabled by default in `cwf-maxwell-chat`:
```javascript
enableTrace: true
```

The trace is returned in the API response and displayed in the UI via a collapsible "Show trace" button.

### Test Entity Context

The Lambda logs session attributes being sent:
```javascript
console.log('Session attributes being sent to Maxwell:', JSON.stringify(stringifiedAttributes, null, 2));
```

Check CloudWatch logs for the `cwf-maxwell-chat` Lambda to verify entity context is being passed correctly.

## Cost Estimation

Based on Claude 3.5 Haiku pricing:
- Input: $0.80 per million tokens
- Output: $4.00 per million tokens

Typical Maxwell interaction:
- Simple question: ~$0.001-0.002 (0.1-0.2 cents)
- Question with tool call: ~$0.003-0.005 (0.3-0.5 cents)
- **Average: ~$0.003 per question (1/3 of a cent)**

100 questions ≈ $0.30
1,000 questions ≈ $3.00

## Troubleshooting

### Agent Not Using Latest Instruction

**Symptom**: Agent behavior doesn't reflect changes in `maxwell-instruction.txt`

**Cause**: The alias is pointing to an old version

**Solution**: Create a new version and update the alias (see deployment process above)

### Agent Asking for Entity Details

**Symptom**: Maxwell asks "What entity are you asking about?"

**Cause**: Entity context not being injected properly

**Check**:
1. Verify Lambda environment variable: `MAXWELL_AGENT_ALIAS_ID=EOLN5DJPW4`
2. Check CloudWatch logs for "Session attributes being sent to Maxwell"
3. Verify the enhanced message includes `[Context: ...]` prefix

### Tool Lambda Errors

**Symptom**: "Invalid entityType" or "Missing required parameter"

**Cause**: Tool Lambda not reading session attributes correctly

**Solution**: The tool Lambda now reads from session attributes first, then falls back to parameters:
```javascript
let entityId = sessionAttributes.entityId || params.entityId;
let entityType = sessionAttributes.entityType || params.entityType;
```

## Related Files

- `lambda/maxwell-chat/maxwell-instruction.txt` - Agent instruction
- `lambda/maxwell-chat/index.js` - Chat Lambda
- `lambda/maxwell-observations/index.js` - Tool Lambda
- `src/components/MaxwellPanel.tsx` - Frontend UI
- `src/hooks/useMaxwell.ts` - Frontend hook
- `lambda/maxwell-chat/design.md` - Original design document
- `lambda/maxwell-chat/PHOTO_RENDERING.md` - Photo rendering feature doc

## Version History

- **Version 1**: Initial release
- **Version 2**: First instruction update
- **Version 3**: Updated instruction with tool calling emphasis
- **Version 4**: Non-judgmental synthesis instruction with "Entropy Reducing Options"
