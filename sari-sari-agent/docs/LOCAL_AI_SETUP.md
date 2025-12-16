# Local AI Integration Setup Guide

This guide explains how to set up local AI providers for the Sari-Sari Agent, optimized for RTX 4060 GPUs and cost-free inference.

## Overview

The Sari-Sari Agent supports both cloud (Amazon Bedrock) and local AI providers. Local AI provides:

- **Zero cost** inference (no API fees)
- **Privacy** - all processing happens locally
- **Offline capability** - works without internet
- **RTX 4060 optimization** - efficient GPU utilization

## Supported Local AI Providers

### 1. Ollama (Recommended)
- **Best for**: Easy setup, command-line interface
- **Models**: Llama 3.1 8B, Mistral 7B, Phi-3 Mini
- **Default endpoint**: `http://localhost:11434`

### 2. LM Studio
- **Best for**: GUI interface, model management
- **Models**: Phi-3 Mini, Llama 3.2 3B, Gemma 2B
- **Default endpoint**: `http://localhost:1234`

## Quick Setup

### Option 1: Ollama Setup

```bash
# 1. Install Ollama
# Download from https://ollama.ai

# 2. Pull recommended model
ollama pull llama3.1:8b

# 3. Test the model
ollama run llama3.1:8b "Hello, how are you?"

# 4. Verify service is running
curl http://localhost:11434/api/tags
```

### Option 2: LM Studio Setup

1. Download LM Studio from https://lmstudio.ai
2. Install and launch the application
3. Search for and download: `microsoft/Phi-3-mini-4k-instruct-gguf`
4. Start the local server (default port 1234)
5. Test in the LM Studio chat interface

## Configuration

Add local AI configuration to your environment:

```typescript
// In your config
const config = {
  nlp: {
    aiRouter: {
      preferredProvider: 'local', // or 'cloud' or 'auto'
      localProvider: {
        provider: 'ollama', // or 'lmstudio'
        endpoint: 'http://localhost:11434',
        model: 'llama3.1:8b',
        maxTokens: 500,
        temperature: 0.7
      }
    }
  }
}
```

## Model Recommendations for RTX 4060

### Recommended (8GB VRAM)
- **llama3.1:8b** - Best overall performance
- **mistral:7b** - Good for reasoning tasks
- **phi3:mini** - Fastest inference

### Lightweight (4-6GB VRAM)
- **phi3:mini** - Microsoft's efficient model
- **gemma:2b** - Google's compact model
- **qwen2:1.5b** - Very fast, basic tasks

### Performance (8GB+ VRAM)
- **llama3.1:8b** - Production ready
- **codellama:7b** - Code-focused tasks
- **mistral:7b** - Advanced reasoning

## Usage Examples

### Automatic Provider Selection

```typescript
import { NLPService } from './nlp/NLPService';
import { createQuickLocalConfig } from './nlp/LocalAIConfig';

// Auto-detect and use local AI if available
const nlpService = new NLPService({
  aiRouter: {
    preferredProvider: 'auto',
    localProvider: createQuickLocalConfig('ollama')
  }
});

// Classify intent (will use local AI if available)
const result = await nlpService.classifyIntent('Hello there!', context);
```

### Force Local AI Usage

```typescript
const nlpService = new NLPService({
  aiRouter: {
    preferredProvider: 'local',
    localProvider: {
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3.1:8b'
    }
  }
});
```

### Service Detection

```typescript
import { getLocalAIConfig } from './nlp/LocalAIConfig';

const configManager = getLocalAIConfig();

// Detect available services
const services = await configManager.detectAvailableServices();
console.log('Available services:', services);
// { ollama: true, lmstudio: false, endpoints: ['http://localhost:11434'] }

// Get setup instructions
const instructions = configManager.generateSetupInstructions('ollama');
console.log(instructions);
```

## Performance Optimization

### RTX 4060 Settings
- **Max Tokens**: 500-800 (avoid memory issues)
- **Temperature**: 0.7 (good balance)
- **Batch Size**: 1 (single requests)
- **Context Length**: 4096 tokens max

### Memory Management
```typescript
// Optimized config for RTX 4060
const config = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama3.1:8b',
  maxTokens: 500,        // Conservative limit
  temperature: 0.7,      // Balanced creativity
}
```

## Troubleshooting

### Common Issues

1. **Service Not Available**
   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/api/tags
   
   # Start Ollama service
   ollama serve
   ```

2. **Model Not Found**
   ```bash
   # List available models
   ollama list
   
   # Pull missing model
   ollama pull llama3.1:8b
   ```

3. **GPU Memory Issues**
   - Reduce `maxTokens` to 300-500
   - Use smaller models (phi3:mini, gemma:2b)
   - Close other GPU applications

4. **Slow Performance**
   - Ensure GPU drivers are updated
   - Check GPU utilization: `nvidia-smi`
   - Use quantized models (Q4_K_M variants)

### Validation

```typescript
import { getLocalAIConfig } from './nlp/LocalAIConfig';

const configManager = getLocalAIConfig();
const validation = await configManager.validateConfig(yourConfig);

if (!validation.valid) {
  console.log('Issues:', validation.issues);
  console.log('Suggestions:', validation.suggestions);
}
```

## Integration with Cloud AI

The system automatically falls back to cloud AI (Bedrock) when local AI is unavailable:

```typescript
const nlpService = new NLPService({
  aiRouter: {
    preferredProvider: 'auto',
    localProvider: createQuickLocalConfig('ollama'),
    cloudProvider: {
      provider: 'bedrock',
      model: 'anthropic.claude-3-sonnet-20240229-v1:0'
    }
  }
});

// Will try local first, fallback to cloud if needed
const result = await nlpService.classifyIntent(message, context);
```

## Cost Comparison

| Provider | Cost per 1000 requests | Setup Time | Performance |
|----------|------------------------|------------|-------------|
| Local AI | $0.00 | 30 minutes | Good |
| Bedrock  | ~$1.50 | 5 minutes | Excellent |

## Next Steps

1. **Install** your preferred local AI provider
2. **Test** with the provided examples
3. **Configure** the Sari-Sari Agent to use local AI
4. **Monitor** performance and adjust settings
5. **Scale** by adding multiple endpoints if needed

For advanced configuration and multiple GPU setups, see the [Advanced Local AI Guide](./ADVANCED_LOCAL_AI.md).