---
name: novyx-memory
description: Native persistent memory layer for OpenClaw. Automatically saves user/agent messages to Novyx Core and recalls context for infinite conversation history. Includes rate-limit handling and graceful degradation.
version: 1.0.0
author: Novyx Labs
repository: https://github.com/novyxlabs/novyx-memory
---

# Novyx Memory Skill

**Infinite Context for AI Agents.**
This skill provides a middleware layer that connects your OpenClaw agent to **Novyx Core** for long-term memory persistence.

## Features
- **Auto-Save**: Logs every user message and agent response to Novyx.
- **Auto-Recall**: Fetches relevant history before responding to give the agent context.
- **Graceful Handling**: Catches API limits (429/403) and degrades gracefully without crashing.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install axios dotenv
    ```

2.  **Configure Environment**:
    Add to your `.env` file:
    ```bash
    NOVYX_API_KEY=your_api_key_here
    ```

3.  **Integrate Middleware**:
    In your bot's main loop (e.g., `index.js` or `bot.js`), import and use the middleware:

    ```javascript
    const NovyxMemory = require('./skills/novyx-memory');
    const memory = new NovyxMemory();

    // On incoming message:
    const context = await memory.onMessage(userMessage, sessionId);
    // Inject context into your prompt

    // On outgoing response:
    memory.onResponse(agentResponse, sessionId);
    ```

## Configuration Options
| Option | Default | Description |
| :--- | :--- | :--- |
| `apiKey` | `process.env.NOVYX_API_KEY` | Your Novyx API Key |
| `autoSave` | `true` | Automatically save messages to Novyx |
| `autoRecall` | `true` | Automatically recall context before replying |
| `recallLimit` | `5` | Number of memories to retrieve |

## Error Handling
If the API limit is reached (429) or invalid key (403), the skill will log a warning:
`[Novyx] ⚠️ Memory limit reached. Upgrade at novyxlabs.com/pricing`
It will **not** crash your bot; memory features will simply be disabled until the limit resets.
