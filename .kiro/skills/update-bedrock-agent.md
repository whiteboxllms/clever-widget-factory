---
inclusion: manual
---

# Update Bedrock Agent Skill

When the user invokes this skill, follow this process to update the Maxwell Bedrock Agent. This covers model changes, instruction updates, and action group modifications.

## Key Facts

- **Agent ID**: `CNV04Q1OAZ`
- **Production Alias ID**: `EOLN5DJPW4`
- **Region**: `us-west-2`
- **Agent Role ARN**: `arn:aws:iam::131745734428:role/maxwell-bedrock-agent-role`
- **Instruction file**: `lambda/maxwell-chat/maxwell-instruction.txt`

## Critical: How Versioning Works

There is **no `create-agent-version` CLI command**. Agent versions are created indirectly:

- **Updating an alias without specifying `routing-configuration`** triggers automatic version creation from the prepared DRAFT.
- The alias is then automatically pointed to the new numbered version.
- All previous versions are preserved as immutable snapshots.
- The `DRAFT` version is the working version you modify and test.
- Non-DRAFT aliases **cannot** point to `DRAFT` directly.

Source: [Amazon Bedrock Agent Versioning Complete Guide](https://community.aws/content/2tgaWN2cB7eYWNJpiXaS9ueEvHW/amazon-bedrock-agent-versioning-complete-guide)

## Step 1: Check Current State

```bash
aws bedrock-agent get-agent --agent-id CNV04Q1OAZ --region us-west-2 \
  --query 'agent.{model:foundationModel,status:agentStatus,instruction:instruction}' \
  --output json
```

```bash
aws bedrock-agent get-agent-alias --agent-id CNV04Q1OAZ --agent-alias-id EOLN5DJPW4 --region us-west-2 \
  --query 'agentAlias.{status:agentAliasStatus,routing:routingConfiguration,description:description}' \
  --output json
```

Report the current model, agent status, and which version the production alias points to.

## Step 2: Update the Agent (DRAFT)

Use `update-agent` to modify the DRAFT version. All required fields must be provided:

```bash
aws bedrock-agent update-agent \
  --agent-id CNV04Q1OAZ \
  --agent-name Maxwell \
  --foundation-model "<MODEL_ID>" \
  --agent-resource-role-arn "arn:aws:iam::131745734428:role/maxwell-bedrock-agent-role" \
  --idle-session-ttl-in-seconds 600 \
  --instruction "$(cat lambda/maxwell-chat/maxwell-instruction.txt)" \
  --region us-west-2 \
  --output json
```

If only updating the instruction file (not the model), read the current model from Step 1 and pass it unchanged.

Verify the response shows `agentStatus: UPDATING`.

## Step 3: Prepare the Agent

```bash
aws bedrock-agent prepare-agent --agent-id CNV04Q1OAZ --region us-west-2 --output json
```

Wait for preparation to complete (typically 10-15 seconds), then verify:

```bash
aws bedrock-agent get-agent --agent-id CNV04Q1OAZ --region us-west-2 \
  --query 'agent.{status:agentStatus,model:foundationModel}' --output json
```

Do not proceed until `agentStatus` is `PREPARED`.

## Step 4: Deploy — Update the Production Alias

Update the alias **without** `routing-configuration` to trigger automatic version creation:

```bash
aws bedrock-agent update-agent-alias \
  --agent-id CNV04Q1OAZ \
  --agent-alias-id EOLN5DJPW4 \
  --agent-alias-name production \
  --description "<BRIEF_DESCRIPTION_OF_CHANGE>" \
  --region us-west-2 \
  --output json
```

The description should summarize what changed (e.g., "Upgraded to Sonnet 4.6 with UnifiedSearch tool").

Wait for the alias to finish updating, then verify:

```bash
aws bedrock-agent get-agent-alias --agent-id CNV04Q1OAZ --agent-alias-id EOLN5DJPW4 --region us-west-2 \
  --query 'agentAlias.{status:agentAliasStatus,routing:routingConfiguration,description:description}' \
  --output json
```

Confirm:
- `agentAliasStatus` is `PREPARED`
- `routingConfiguration` shows a **new version number** (higher than the previous)

## Step 5: Verify the New Version

```bash
aws bedrock-agent get-agent-version --agent-id CNV04Q1OAZ \
  --agent-version <NEW_VERSION_NUMBER> --region us-west-2 \
  --query 'agentVersion.{model:foundationModel,status:agentStatus}' --output json
```

Confirm the new version has the expected model and status `PREPARED`.

## Step 6: Summary

Report:

```
Bedrock Agent Update Summary
─────────────────────────────
Previous version:  <OLD_VERSION>
New version:       <NEW_VERSION>
Model:             <MODEL_ID>
Instruction:       Updated / Unchanged
Alias status:      PREPARED
```

## Rollback Procedure

If the new version has issues, point the alias back to the previous version:

```bash
aws bedrock-agent update-agent-alias \
  --agent-id CNV04Q1OAZ \
  --agent-alias-id EOLN5DJPW4 \
  --agent-alias-name production \
  --routing-configuration '[{"agentVersion":"<PREVIOUS_VERSION>"}]' \
  --description "Rolled back to version <PREVIOUS_VERSION>" \
  --region us-west-2 \
  --output json
```

## Available Models Reference

To check which models are available:

```bash
aws bedrock list-foundation-models --region us-west-2 \
  --query "modelSummaries[?starts_with(modelId,'anthropic.claude')].{modelId:modelId,modelName:modelName}" \
  --output table
```

### Critical: Marketplace Subscription for Anthropic Models

Newer Anthropic models require an AWS Marketplace subscription on first use. If you get:

> "Model access is denied due to IAM user or service role is not authorized to perform the required AWS Marketplace actions"

The agent role needs the `AWSMarketplaceManageSubscriptions` managed policy:

```bash
aws iam attach-role-policy \
  --role-name maxwell-bedrock-agent-role \
  --policy-arn arn:aws:iam::aws:policy/AWSMarketplaceManageSubscriptions
```

This is already attached. If it gets removed, re-attach it before switching models.

### Critical: Inference Profiles

Newer models (Sonnet 4+, Opus 4+, Haiku 4.5+) **cannot be invoked directly** with on-demand throughput. They require an **inference profile**. If you get this error:

> "Invocation of model ID X with on-demand throughput isn't supported. Retry your request with the ID or ARN of an inference profile that contains this model."

You need to use the inference profile ID instead of the raw model ID. Find available profiles:

```bash
aws bedrock list-inference-profiles --region us-west-2 \
  --query "inferenceProfileSummaries[*].{id:inferenceProfileId,name:inferenceProfileName}" \
  --output table | grep -i "sonnet\|opus\|haiku"
```

Use the `us.*` prefixed profile (e.g., `us.anthropic.claude-sonnet-4-6`) as the `--foundation-model` value in `update-agent`.

### IAM Policy for Inference Profiles

The agent role (`maxwell-bedrock-agent-role`) must allow both foundation model and inference profile resources:

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": [
    "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-*",
    "arn:aws:bedrock:us-west-2:131745734428:inference-profile/us.anthropic.claude-*",
    "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
  ]
}
```

To update the policy:

```bash
aws iam put-role-policy \
  --role-name maxwell-bedrock-agent-role \
  --policy-name maxwell-bedrock-agent-policy \
  --policy-document '<FULL_POLICY_JSON>'
```

## Action Group Management

### List current action groups:

```bash
aws bedrock-agent list-agent-action-groups --agent-id CNV04Q1OAZ --agent-version DRAFT --region us-west-2 --output json
```

### Add a new action group:

```bash
aws bedrock-agent create-agent-action-group \
  --agent-id CNV04Q1OAZ \
  --agent-version DRAFT \
  --action-group-name "<NAME>" \
  --action-group-executor '{"lambda":"arn:aws:lambda:us-west-2:131745734428:function:<FUNCTION_NAME>"}' \
  --api-schema '{"payload":"<OPENAPI_JSON_STRING>"}' \
  --region us-west-2 \
  --output json
```

### Remove an action group:

```bash
aws bedrock-agent delete-agent-action-group \
  --agent-id CNV04Q1OAZ \
  --agent-version DRAFT \
  --action-group-id "<ACTION_GROUP_ID>" \
  --region us-west-2
```

After any action group changes, re-run Steps 3-5 (prepare, deploy alias, verify).
