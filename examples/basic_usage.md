# Basic Usage

## Integration with Your Agent

```javascript
const NovyxMemory = require('novyx-memory');

const memory = new NovyxMemory({
  // apiKey defaults to NOVYX_API_KEY env var
  autoSave: true,
  autoRecall: true,
  recallLimit: 5,
});

// Your agent's message loop
async function handleMessage(userMessage, sessionId) {
  // Step 1: Process through Novyx Memory
  // This auto-recalls relevant context and checks for commands
  const enrichedMessage = await memory.onMessage(userMessage, sessionId);

  // If it's a command (!undo, !search, etc.), the result is already formatted
  if (enrichedMessage !== userMessage && !enrichedMessage.startsWith('[Recalled Memory]')) {
    return enrichedMessage; // Command output — send directly to user
  }

  // Step 2: Send to your LLM (enrichedMessage includes recalled context)
  const agentResponse = await yourLLM.generate(enrichedMessage);

  // Step 3: Auto-save the response
  await memory.onResponse(agentResponse, sessionId);

  return agentResponse;
}
```

## What Happens Automatically

### On Every User Message
1. Checks for commands (`!rollback`, `!search`, `!undo`, etc.)
2. Skips trivial messages (< 15 chars) to save API calls
3. Searches for relevant memories and prepends them as context
4. Saves the user message (fire-and-forget, won't slow down response)

### On Every Agent Response
1. Skips trivial responses (< 20 chars)
2. Truncates long responses to 500 chars before saving
3. Saves to Novyx (fire-and-forget)

## Context Injection Format

When memories are recalled, they're prepended to the user message:

```
[Recalled Memory]
- The project uses Postgres 15 on AWS RDS
- We deploy via GitHub Actions to ECS
- The API rate limit is 1000 req/min

User: What database are we using?
```

Your LLM sees this enriched prompt and can reference the recalled context.
