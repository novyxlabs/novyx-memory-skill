---
name: novyx-memory
description: >
  Persistent cloud memory with rollback, audit trails, and knowledge graph.
  Use when: agent needs cross-session memory, undo bad data, or prove what happened.
  NOT for: ephemeral scratch state or single-session context.
version: 2.0.0
author: Novyx Labs
homepage: https://novyxlabs.com
repository: https://github.com/novyxlabs/novyx-memory-skill
metadata:
  openclaw:
    emoji: "🧠"
    primaryEnv: NOVYX_API_KEY
    requires:
      env:
        - NOVYX_API_KEY
---

# Novyx Memory

Cloud-hosted persistent memory with semantic search, time-travel rollback, tamper-proof audit trails, and a knowledge graph. Free tier — no credit card.

## When to Use

- Agent needs memory that survives restarts, deploys, and device switches
- You need to **undo** corrupted or wrong memories (`!rollback 1h`)
- You need a **tamper-proof audit trail** of every memory operation (`!audit`)
- You want **semantic search** across memories, not keyword matching (`!search`)
- Multiple agents need **shared memory** via context spaces

## When NOT to Use

- You only need in-session scratch memory (use built-in context)
- You need local-only storage with no network calls

## Auto-Behavior

- **Auto-recalls** relevant memories before each response and injects them as context
- **Auto-saves** user messages and agent responses to persistent storage
- Skips trivial messages (<15 chars) to conserve API calls

## Commands

| Command | What it does |
|---------|-------------|
| `!remember <text>` | Save a specific fact |
| `!search <query>` | Semantic search with relevance scores |
| `!rollback <time>` | Rewind memory to a point in time |
| `!forget <topic>` | Delete memories matching a topic |
| `!undo [N]` | Delete last N saved memories |
| `!audit [N]` | Show operations with integrity hashes |
| `!edges [subject]` | Query knowledge graph relationships |
| `!status` | Usage, tier, and rollback count |

## What Makes This Different

| | novyx-memory | Built-in memory | Mem0 | Zep |
|---|---|---|---|---|
| Rollback | Any point in time | No | No | No |
| Audit trail | SHA-256 hash-chained | No | No | No |
| Knowledge graph | Entity triples | No | No | No |
| Search | pgvector semantic (384-dim) | Keyword | Yes | Yes |
| Persistence | Cloud | Local file | Cloud | Cloud |
| Free tier | 5K memories | Unlimited (local) | 1K | Paid only |

## Setup

```bash
export NOVYX_API_KEY=nram_your_key_here
# Get a free key at https://novyxlabs.com/pricing
```
