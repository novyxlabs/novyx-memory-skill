# Novyx Memory

**Persistent memory with undo for OpenClaw agents.**

Your agent remembers conversations across sessions. Relevant memories are recalled before every response. Made a mistake? `!undo` deletes the last write. Want proof? `!audit` shows every operation with tamper-proof hashes.

## How It Works

```
You:     Tell my agent about Project Atlas.
Agent:   Got it. I'll remember Project Atlas uses Postgres and Redis.
         [auto-saved to Novyx]

You:     What database are we using?
Agent:   You're using Postgres for Project Atlas.
         [auto-recalled from Novyx — remembered across sessions]

You:     Actually, forget that. We switched to MySQL.
You:     !undo
Agent:   Undid 1 memory.

You:     !audit
Agent:   Recent Operations:
         2:31:05 PM POST /v1/memories → 200 [a3f8c2d1]
         2:31:03 PM GET  /v1/memories/search → 200 [b7e4a9f0]
```

## Commands

| Command | What it does |
|---------|-------------|
| `!undo [N]` | Delete last N saved memories (default: 1) |
| `!audit [N]` | Show last N API operations with hashes (default: 10) |
| `!status` | Memory usage, tier, and undo history |
| `!help` | List commands |

## Install

```bash
git clone https://github.com/novyxlabs/novyx-memory-skill.git extensions/novyx-memory
cd extensions/novyx-memory && npm install
```

Create `.env`:
```
NOVYX_API_KEY=your_key_here
```

Get a free API key at [novyxlabs.com](https://novyxlabs.com) (5,000 memories, no credit card).

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
| `autoSave` | `true` | Automatically save messages to Novyx |
| `autoRecall` | `true` | Inject relevant memories into context before each response |
| `recallLimit` | `5` | Max memories to recall per query |

## What Novyx Features This Uses

- **`POST /v1/memories`** — save conversation turns with session tags
- **`GET /v1/memories/search`** — semantic recall of relevant memories
- **`DELETE /v1/memories/{id}`** — undo writes by deleting saved memories
- **`GET /v1/audit`** — tamper-proof operation log with hash chain
- **`GET /v1/usage`** — tier and usage stats

## Run the Test

```bash
NOVYX_API_KEY=your_key node verify_install.js
```

## License

MIT
