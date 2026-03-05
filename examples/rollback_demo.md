# Rollback Demo

The killer feature that no other memory tool has. Here's a step-by-step walkthrough.

## Scenario: Bad Data Got Into Memory

### Step 1: Save Some Facts

```
You:     !remember Our API uses REST with JSON responses
Agent:   Saved: "Our API uses REST with JSON responses"

You:     !remember The database is Postgres 15 on AWS RDS
Agent:   Saved: "The database is Postgres 15 on AWS RDS"

You:     !remember We deploy to production via GitHub Actions
Agent:   Saved: "We deploy to production via GitHub Actions"
```

### Step 2: Verify Memory Works

```
You:     !search database
Agent:   Search: "database"
         1. 94% The database is Postgres 15 on AWS RDS

You:     !status
Agent:   Memory Status
         Tier: Free
         Memories: 3 / 5,000 (0%)
         API Calls: 8 / 500
         Rollbacks: 0 / 10
```

### Step 3: Something Goes Wrong

An agent session saves incorrect information:

```
Agent:   I've updated the project — you're now using MongoDB on Azure.
         [auto-saved to Novyx — this is WRONG]

You:     !search database
Agent:   Search: "database"
         1. 89% I've updated the project — you're now using MongoDB on Azure.
         2. 72% The database is Postgres 15 on AWS RDS
```

The wrong answer is now ranked higher. Your agent will give incorrect responses.

### Step 4: Rollback

```
You:     !rollback 1h
Agent:   Rolled back to 2026-03-05T14:00:00Z
         1 memories restored, 2 operations undone.
```

### Step 5: Verify It's Fixed

```
You:     !search database
Agent:   Search: "database"
         1. 94% The database is Postgres 15 on AWS RDS
```

The incorrect MongoDB memory is gone. The correct Postgres memory is back on top.

### Step 6: Check the Audit Trail

```
You:     !audit
Agent:   Recent Operations:
         3:01 PM POST /v1/rollback → 201 [f8a2c3d1]
         2:45 PM POST /v1/memories → 201 [b7e4a9f0]
         2:30 PM GET  /v1/memories/search → 200 [a3f8c2d1]
         2:15 PM POST /v1/memories → 201 [c9d2e8f4]
         2:10 PM POST /v1/memories → 201 [d1a3b5c7]

         12 total operations on record.
```

Every operation is logged with a SHA-256 hash. The chain is tamper-proof — if any entry is modified, the hash chain breaks.

## Other Rollback Formats

```
!rollback 30m          → 30 minutes ago
!rollback 2h           → 2 hours ago
!rollback 1d           → 1 day ago
!rollback 3 days ago   → 3 days ago
!rollback 2026-03-01T00:00:00Z  → specific timestamp
```

## Free Tier Limits

- 10 rollbacks per month on the free tier
- Unlimited on Starter ($12/mo) and above
- Each rollback counts as one operation regardless of how many memories are affected
