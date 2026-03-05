---
name: novyx-memory
description: "Save, search, rollback, and audit AI agent memory across sessions with semantic search and tamper-proof audit trails"
version: 2.0.0
homepage: https://novyxlabs.com
metadata:
  openclaw:
    primaryEnv: NOVYX_API_KEY
    requires:
      env:
        - NOVYX_API_KEY
---

# Novyx Memory

Persistent memory middleware for OpenClaw agents. Automatically saves conversation context and recalls relevant memories before each response. Supports time-travel rollback, semantic search, and tamper-proof audit trails.

## When to Use This Skill

Use Novyx Memory when:
- The user wants an agent that remembers across sessions
- The user needs to undo or roll back incorrect information
- The user asks for conversation history or audit logs
- The user wants semantic search over past interactions

## Automatic Behavior

When active, this skill:
- **Auto-recalls** relevant memories before each response and injects them as context
- **Auto-saves** each user message and agent response to persistent storage
- Skips trivial messages (under 15 characters) to conserve API calls

## Commands

Users can type these commands in chat:

| Command | What it does |
|---------|-------------|
| `!remember <text>` | Explicitly save a specific fact or note |
| `!search <query>` | Search memories by meaning (semantic search) with relevance scores |
| `!rollback <time>` | Rewind all memory to a point in time. Accepts "1h", "30m", "2 days ago", or ISO timestamps |
| `!forget <topic>` | Find and delete all memories matching a topic |
| `!undo [N]` | Delete the last N saved memories (default: 1) |
| `!audit [N]` | Show the last N API operations with tamper-proof hashes (default: 10) |
| `!status` | Show memory usage, tier, API calls, and rollback count |
| `!help` | List all available commands |

## Key Differentiators

- **Rollback**: No other memory tool supports time-travel. `!rollback 1h` restores memory to exactly one hour ago.
- **Audit trail**: Every operation is logged with SHA-256 hashes forming a tamper-proof chain.
- **Semantic search**: Finds memories by meaning, not just keywords.
- **Graceful degradation**: If rate limits are hit or the API is unavailable, the agent continues working without memory features — it never crashes.

## Configuration

Requires `NOVYX_API_KEY` environment variable. Get a free key at https://novyxlabs.com (5,000 memories, no credit card).

Options:
- `autoSave` (default: true) — Automatically save messages
- `autoRecall` (default: true) — Automatically recall context
- `recallLimit` (default: 5) — Max memories to recall per query
