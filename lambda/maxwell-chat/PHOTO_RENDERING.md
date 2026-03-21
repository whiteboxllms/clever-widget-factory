# Photo Rendering Implementation

## Overview

Maxwell includes photos inline in responses using markdown image syntax. The frontend parses and renders these as `<img>` tags.

## How It Works

### 1. Agent Instruction (System Prompt)

Maxwell's system prompt instructs it to:
> "When observations include photos, include them in your response using markdown image syntax: ![description](url)"

See `SYSTEM_PROMPT.md` for the full prompt.

### 2. Tool Response

The `GetEntityObservations` tool returns photos as:
```json
{
  "observations": [
    {
      "observation_text": "Blade shows rust",
      "photos": [
        {
          "photo_url": "https://cwf-dev-assets.s3.amazonaws.com/...",
          "photo_description": "Rust on blade edge"
        }
      ]
    }
  ]
}
```

### 3. Agent Response

Maxwell synthesizes a response like:
```
Based on the observation from March 3rd, the blade shows rust. 
![Rust on blade edge](https://cwf-dev-assets.s3.amazonaws.com/...)
```

### 4. Frontend Rendering

`MaxwellPanel.tsx` parses markdown images using regex:
```typescript
const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
```

And renders them as:
```tsx
<img 
  src={url} 
  alt={description} 
  className="mt-2 max-w-full rounded-lg"
  style={{ maxHeight: '300px', objectFit: 'contain' }}
/>
```

## Benefits

- **Contextual**: Photos appear inline with relevant text
- **Streaming-friendly**: Works with Bedrock's streaming response
- **Agent-controlled**: Maxwell decides which photos are relevant
- **Simple**: No complex trace parsing or structured data extraction

## Testing

To test photo rendering:

1. Create an observation with photos on a tool/part/action
2. Open Maxwell panel from that entity
3. Ask: "What observations have been recorded?"
4. Verify photos appear inline in Maxwell's response

## Configuration Required

Update Maxwell's system prompt in AWS Bedrock Console:
- Navigate to: Bedrock → Agents → maxwell → Edit
- Add the photo rendering instruction from `SYSTEM_PROMPT.md`
- Prepare and deploy the agent
