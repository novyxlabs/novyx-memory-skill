#!/usr/bin/env node
/**
 * novyx-memory v2.0.0 — Persistent Memory for OpenClaw Agents
 *
 * The only memory skill with rollback, audit trails, and knowledge graph.
 * Auto-recall, auto-capture, search, forget, undo — all built in.
 *
 * MIT License — Novyx Labs
 */

const axios = require('axios');
require('dotenv').config();

const VERSION = '2.0.0';

class NovyxMemory {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://novyx-ram-api.fly.dev';
    this.autoSave = config.autoSave !== false;
    this.autoRecall = config.autoRecall !== false;
    this.recallLimit = config.recallLimit || 5;

    // Session write log for !undo (transient — resets on restart)
    this._writeLog = [];

    if (!this.apiKey) {
      console.warn('[NovyxMemory] No API key. Get a free one at https://novyxlabs.com (5,000 memories, no credit card)');
    }

    this.commands = [
      { trigger: '!remember', handler: this.handleRemember.bind(this) },
      { trigger: '!search', handler: this.handleSearch.bind(this) },
      { trigger: '!rollback', handler: this.handleRollback.bind(this) },
      { trigger: '!forget', handler: this.handleForget.bind(this) },
      { trigger: '!undo', handler: this.handleUndo.bind(this) },
      { trigger: '!audit', handler: this.handleAudit.bind(this) },
      { trigger: '!edges', handler: this.handleEdges.bind(this) },
      { trigger: '!status', handler: this.handleStatus.bind(this) },
      { trigger: '!help', handler: this.handleHelp.bind(this) },
    ];
  }

  // ---- Centralized API Helper ----

  async _apiCall(method, path, data = null, params = null) {
    if (!this.apiKey) return null;
    try {
      const config = {
        method,
        url: `${this.apiUrl}${path}`,
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: path.includes('rollback') ? 30000 : 10000,
      };
      if (data) config.data = data;
      if (params) config.params = params;
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this._handleError(error, path);
      return null;
    }
  }

  // ---- Core API Methods ----

  async remember(observation, tags = []) {
    if (!this.apiKey || !this.autoSave) return null;
    const result = await this._apiCall('post', '/v1/memories', { observation, tags });
    if (result) {
      const id = result.uuid || result.id;
      if (id) {
        this._writeLog.push({
          id,
          observation: observation.slice(0, 80),
          at: new Date().toISOString(),
        });
      }
    }
    return result;
  }

  async forget(memoryId) {
    if (!this.apiKey) return null;
    const result = await this._apiCall('delete', `/v1/memories/${memoryId}`);
    return result ? { deleted: true } : null;
  }

  async recall(query, limit = this.recallLimit) {
    if (!this.apiKey || !this.autoRecall) return [];
    const result = await this._apiCall('get', '/v1/memories/search', null, { q: query, limit });
    return result?.memories || [];
  }

  async usage() {
    return this._apiCall('get', '/v1/usage');
  }

  async audit(limit = 10) {
    return this._apiCall('get', '/v1/audit', null, { limit });
  }

  async edges(opts = {}) {
    const params = { limit: opts.limit || 50 };
    if (opts.subject) params.subject = opts.subject;
    if (opts.predicate) params.predicate = opts.predicate;
    if (opts.object) params.object = opts.object;
    const result = await this._apiCall('get', '/v1/knowledge/triples', null, params);
    return result?.triples || [];
  }

  // ---- Middleware Hooks ----

  async onMessage(userMessage, sessionId) {
    // Check commands first (exact match or trigger + space)
    for (const cmd of this.commands) {
      if (userMessage === cmd.trigger || userMessage.startsWith(cmd.trigger + ' ')) {
        return await cmd.handler(userMessage, sessionId);
      }
    }

    // Skip trivial messages to conserve API calls
    if (userMessage.length < 15) {
      return userMessage;
    }

    // Auto-recall: inject relevant memories as context
    const context = await this.recall(userMessage, this.recallLimit);

    // Auto-save user message (fire and forget)
    this.remember(userMessage, ['role:user', `session:${sessionId}`]).catch(() => {});

    // If we found relevant memories, format them as context prefix
    if (context.length > 0) {
      const contextBlock = context.map(m => `- ${m.observation}`).join('\n');
      return `[Recalled Memory]\n${contextBlock}\n\nUser: ${userMessage}`;
    }

    return userMessage;
  }

  async onResponse(agentResponse, sessionId) {
    if (!this.apiKey) return;
    // Skip trivial responses
    if (!agentResponse || agentResponse.length < 20) return;
    // Truncate long responses to avoid storing filler
    const observation = agentResponse.length > 500
      ? agentResponse.slice(0, 500) + '...'
      : agentResponse;
    this.remember(observation, ['role:assistant', `session:${sessionId}`]).catch(() => {});
  }

  // ---- Command Handlers ----

  async handleRemember(message) {
    const text = message.replace('!remember', '').trim();
    if (!text) return 'Usage: `!remember <fact to save>`';
    // Force save even if autoSave is off — use direct API call
    const result = await this._apiCall('post', '/v1/memories', { observation: text, tags: ['explicit'] });
    if (result) {
      const id = result.uuid || result.id;
      if (id) this._writeLog.push({ id, observation: text.slice(0, 80), at: new Date().toISOString() });
    }
    return result ? `Saved: "${text.slice(0, 80)}"` : 'Failed to save. Check your API key.';
  }

  async handleSearch(message) {
    const query = message.replace('!search', '').trim();
    if (!query) return 'Usage: `!search <query>`';
    // Force search even if autoRecall is off — use direct API call
    const result = await this._apiCall('get', '/v1/memories/search', null, { q: query, limit: 5 });
    const results = result?.memories || [];
    if (results.length === 0) return `No memories found for "${query}".`;
    const lines = [`**Search: "${query}"**\n`];
    results.forEach((m, i) => {
      const score = m.score != null ? `${Math.round(m.score * 100)}%` : '--';
      const obs = m.observation.length > 120 ? m.observation.slice(0, 120) + '...' : m.observation;
      lines.push(`${i + 1}. \`${score}\` ${obs}`);
    });
    return lines.join('\n');
  }

  async handleRollback(message) {
    const rawTarget = message.replace('!rollback', '').trim() || '1 hour ago';
    const target = this._parseRelativeTime(rawTarget);
    if (!target) {
      return `Could not parse "${rawTarget}". Try "1h", "30m", "2 days ago", or an ISO timestamp.`;
    }

    // Preview first (dry run)
    const preview = await this._apiCall('post', '/v1/rollback', { target, dry_run: true });
    if (!preview) return 'Rollback failed. This feature requires a Novyx API key (free tier includes 10 rollbacks/month).';

    if (preview.artifacts_restored === 0 && preview.operations_undone === 0) {
      return `Nothing to roll back. No changes found since ${rawTarget}.`;
    }

    // Execute rollback
    const result = await this._apiCall('post', '/v1/rollback', { target, dry_run: false });
    if (!result) return 'Rollback execution failed. Try again or check your API key.';

    return `**Rolled back to ${result.rolled_back_to}**\n` +
           `${result.artifacts_restored} memories restored, ${result.operations_undone} operations undone.`;
  }

  async handleForget(message) {
    const topic = message.replace('!forget', '').trim();
    if (!topic) return 'Usage: `!forget <topic>`';

    // Force search even if autoRecall is off — use direct API call
    const result = await this._apiCall('get', '/v1/memories/search', null, { q: topic, limit: 10 });
    const matches = result?.memories || [];
    const relevant = matches.filter(m => (m.score || 0) > 0.65);

    if (relevant.length === 0) return `No memories found matching "${topic}".`;

    let deleted = 0;
    for (const m of relevant) {
      const result = await this.forget(m.uuid || m.id);
      if (result) deleted++;
    }
    return `Forgot ${deleted} memor${deleted === 1 ? 'y' : 'ies'} about "${topic}".`;
  }

  async handleUndo(message) {
    const countArg = parseInt(message.replace('!undo', '').trim()) || 1;
    const count = Math.min(countArg, this._writeLog.length, 10);

    if (this._writeLog.length === 0) {
      return 'Nothing to undo. No memories saved this session.';
    }

    const toDelete = this._writeLog.splice(-count, count);
    let deleted = 0;
    let failed = 0;

    for (const entry of toDelete.reverse()) {
      const result = await this.forget(entry.id);
      if (result) { deleted++; } else { failed++; }
    }

    let msg = `Undid ${deleted} memor${deleted === 1 ? 'y' : 'ies'}.`;
    if (failed > 0) msg += ` (${failed} failed)`;
    msg += `\n${this._writeLog.length} more in undo history.`;
    return msg;
  }

  async handleAudit(message) {
    const limitArg = parseInt(message.replace('!audit', '').trim()) || 10;
    const data = await this.audit(limitArg);

    if (!data || !data.entries || data.entries.length === 0) {
      return 'No audit entries found.';
    }

    // Show newest first
    const entries = [...data.entries].reverse();
    const lines = ['**Recent Operations:**\n'];
    for (const e of entries.slice(0, limitArg)) {
      const ts = new Date(e.timestamp).toLocaleTimeString();
      const hash = e.entry_hash ? e.entry_hash.slice(0, 8) : '--------';
      lines.push(`\`${ts}\` ${e.method} ${e.endpoint} \u2192 ${e.status} [${hash}]`);
    }
    lines.push(`\n*${data.total_count} total operations on record.*`);
    return lines.join('\n');
  }

  async handleStatus() {
    const usageData = await this.usage();
    if (!usageData) return 'Could not fetch status. Check your API key.';

    const tier = usageData.tier || usageData.plan || 'Free';

    function fmtUsage(obj) {
      if (!obj) return '—';
      const used = obj.current ?? obj.used ?? 0;
      const limit = obj.limit ?? 0;
      const unlimited = obj.unlimited || limit === 0;
      if (unlimited) return `${used.toLocaleString()} (unlimited)`;
      const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
      return `${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)`;
    }

    return `**Memory Status**\n` +
           `Tier: ${tier}\n` +
           `Memories: ${fmtUsage(usageData.memories)}\n` +
           `API Calls: ${fmtUsage(usageData.api_calls)}\n` +
           `Rollbacks: ${fmtUsage(usageData.rollbacks)}\n` +
           `Undo History: ${this._writeLog.length} writes this session`;
  }

  async handleEdges(message) {
    const subject = message.replace('!edges', '').trim() || undefined;
    const triples = await this.edges({ subject, limit: 10 });
    if (triples.length === 0) {
      return subject
        ? `No knowledge graph edges found for "${subject}". Add triples via the API or they'll be auto-generated on Pro tier.`
        : 'No knowledge graph edges found. Triples are auto-generated on Pro tier, or add them via the API.';
    }
    const lines = ['**Knowledge Graph:**\n'];
    for (const t of triples) {
      const subj = t.subject?.name || t.subject || '?';
      const pred = t.predicate || '?';
      const obj = t.object?.name || t.object || '?';
      const conf = t.confidence != null ? ` (${Math.round(t.confidence * 100)}%)` : '';
      lines.push(`  ${subj} → ${pred} → ${obj}${conf}`);
    }
    return lines.join('\n');
  }

  async handleHelp() {
    return '**Novyx Memory Commands:**\n' +
           '- `!remember <text>`: Save a specific fact\n' +
           '- `!search <query>`: Semantic search with relevance scores\n' +
           '- `!rollback <time>`: Rewind memory (e.g., "1h", "2 days ago")\n' +
           '- `!forget <topic>`: Delete memories matching a topic\n' +
           '- `!undo [N]`: Delete last N saved memories (default: 1)\n' +
           '- `!audit [N]`: Show last N API operations with hashes (default: 10)\n' +
           '- `!edges [subject]`: Query knowledge graph relationships (Pro)\n' +
           '- `!status`: Memory usage, tier, and rollback count\n' +
           '- `!help`: This menu\n' +
           '\nMemories are automatically recalled and saved during conversation.';
  }

  // ---- Helpers ----

  _parseRelativeTime(input) {
    const trimmed = input.trim();
    // Match: "1h", "2 hours ago", "30m", "30 minutes", "1d", "2 days ago"
    const match = trimmed.match(/^(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)\s*(ago)?$/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      let ms;
      if (unit.startsWith('h')) ms = amount * 60 * 60 * 1000;
      else if (unit.startsWith('m')) ms = amount * 60 * 1000;
      else if (unit.startsWith('d')) ms = amount * 24 * 60 * 60 * 1000;
      else return null;
      return new Date(Date.now() - ms).toISOString();
    }
    // Try ISO timestamp directly
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  }

  // ---- Error Handling ----


  _handleError(error, action) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      if (status === 429) {
        console.warn(`[NovyxMemory] Rate limit during ${action}. Upgrade at novyxlabs.com/pricing`);
      } else if (status === 403) {
        const detail = data.detail || data.error || '';
        const msg = typeof detail === 'object' ? (detail.message || JSON.stringify(detail)) : String(detail);
        if (msg.toLowerCase().includes('upgrade') || msg.toLowerCase().includes('tier')) {
          console.warn(`[NovyxMemory] ${msg}. Upgrade at novyxlabs.com/pricing`);
        } else {
          console.warn(`[NovyxMemory] Access forbidden during ${action}. Check your API key.`);
        }
      } else {
        console.error(`[NovyxMemory] API Error (${status}) during ${action}:`, data);
      }
    } else if (error.code === 'ECONNABORTED') {
      console.warn(`[NovyxMemory] Request timeout during ${action}. The API may be temporarily slow.`);
    } else if (error.request) {
      console.error(`[NovyxMemory] Network error during ${action}: ${error.message}`);
    }
  }
}

module.exports = NovyxMemory;
module.exports.VERSION = VERSION;

// CLI quick check
if (require.main === module) {
  const m = new NovyxMemory();
  console.log(`novyx-memory v${VERSION} — ${m.apiKey ? 'API key set' : 'no API key'}`);
  console.log('Commands: !remember, !search, !rollback, !forget, !undo, !audit, !edges, !status, !help');
}
