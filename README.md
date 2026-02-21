# novyx-memory

**Persistent memory for OpenClaw agents powered by Novyx Core.**

Give your agent long-term memory that persists across sessions. Memories are automatically recalled before each response and important information is captured after conversations.

## Installation

```bash
git clone https://github.com/novyxlabs/novyx-memory-skill.git extensions/novyx-memory
cd extensions/novyx-memory && npm install
```

## Configuration

Add to your OpenClaw `config.json`:

```json
{
  "extensions": {
    "novyx-memory": {
      "apiKey": "nram_your_key_here"
    }
  }
}
```

Or set the `NOVYX_API_KEY` environment variable.

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | `NOVYX_API_KEY` env var | Novyx API key |
| `apiUrl` | `https://novyx-ram-api.fly.dev` | API base URL |
| `autoRecall` | `true` | Inject relevant memories into context before each response |
| `autoCapture` | `true` | Automatically capture important information from conversations |
| `recallLimit` | `5` | Max memories to recall per query |
| `minCaptureScore` | `0.4` | Minimum relevance score to trigger auto-capture (0-1) |
| `maxContextChars` | `2000` | Max characters to inject into context |

## Tools

### `novyx_search`

Search through stored memories.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Max results (default: 5) |

### `novyx_store`

Save information to memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `observation` | string | Yes | Information to remember |
| `tags` | string[] | No | Tags for categorization |

### `novyx_forget`

Delete a specific memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uuid` | string | Yes | Memory UUID to delete |

### `novyx_edges`

List graph edges (relationships) between memories.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memory_id` | string | No | Filter edges involving a specific memory |
| `relation` | string | No | Filter by relation type (e.g. `auto_related`) |
| `limit` | number | No | Max results (default: 100) |
| `offset` | number | No | Pagination offset (default: 0) |

### `novyx_status`

Check memory usage, plan limits, and billing period. No parameters.

## Auto-Recall & Auto-Capture

When enabled (default), the extension automatically:

- **Before each response**: Searches memories relevant to the user's message and injects them into context
- **After each response**: Evaluates the conversation for important information and stores it

This happens transparently — no tool calls needed.

## Error Handling

If the API limit is reached (429) or key is invalid (403), the extension logs a warning and continues without crashing. Memory features degrade gracefully until the limit resets.

## Tier Limits

| | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Memories | 5,000 | 25,000 | Unlimited | Unlimited |
| API Calls/mo | 5,000 | 25,000 | 100,000 | Unlimited |

## License

MIT
