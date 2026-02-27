#!/usr/bin/env node
/**
 * Novyx Memory v2 — Persistent Memory Middleware for OpenClaw
 *
 * Auto-recall, auto-capture, undo, audit trail.
 * Handles rate limits (429) and forbidden (403) gracefully.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

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
      console.warn('[NovyxMemory] NOVYX_API_KEY is not set. Memory features disabled.');
    }

    this.commands = [
      { trigger: '!undo', handler: this.handleUndo.bind(this) },
      { trigger: '!audit', handler: this.handleAudit.bind(this) },
      { trigger: '!status', handler: this.handleStatus.bind(this) },
      { trigger: '!help', handler: this.handleHelp.bind(this) },
    ];
  }

  // ---- Core API Methods ----

  async remember(observation, tags = []) {
    if (!this.apiKey || !this.autoSave) return null;

    try {
      const response = await axios.post(`${this.apiUrl}/v1/memories`, {
        observation,
        tags
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      // Track the write for !undo
      const id = response.data?.uuid || response.data?.id;
      if (id) {
        this._writeLog.push({
          id,
          observation: observation.slice(0, 80),
          at: new Date().toISOString()
        });
      }

      return response.data;
    } catch (error) {
      this._handleError(error, 'remember');
      return null;
    }
  }

  async forget(memoryId) {
    if (!this.apiKey) return null;

    try {
      const response = await axios.delete(`${this.apiUrl}/v1/memories/${memoryId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data || { deleted: true };
    } catch (error) {
      this._handleError(error, 'forget');
      return null;
    }
  }

  async recall(query, limit = this.recallLimit) {
    if (!this.apiKey || !this.autoRecall) return [];

    try {
      const response = await axios.get(`${this.apiUrl}/v1/memories/search`, {
        params: { q: query, limit },
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data.memories || [];
    } catch (error) {
      this._handleError(error, 'recall');
      return [];
    }
  }

  async stats() {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/memories/stats`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'stats');
      return null;
    }
  }

  async edges(opts = {}) {
    if (!this.apiKey) return null;
    try {
      const params = {};
      if (opts.memory_id) params.memory_id = opts.memory_id;
      if (opts.relation) params.relation = opts.relation;
      if (opts.limit != null) params.limit = opts.limit;
      if (opts.offset != null) params.offset = opts.offset;

      const response = await axios.get(`${this.apiUrl}/v1/memories/edges`, {
        params,
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'edges');
      return null;
    }
  }

  async usage() {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/usage`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'usage');
      return null;
    }
  }

  async audit(limit = 10) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/audit`, {
        params: { limit },
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'audit');
      return null;
    }
  }

  // ---- Middleware Hooks ----

  async onMessage(userMessage, sessionId) {
    // Check commands first
    for (const cmd of this.commands) {
      if (userMessage.startsWith(cmd.trigger)) {
        return await cmd.handler(userMessage, sessionId);
      }
    }

    // Auto-recall: inject relevant memories as context
    const context = await this.recall(userMessage, this.recallLimit);

    // Auto-save user message (fire and forget)
    this.remember(userMessage, [`role:user`, `session:${sessionId}`]).catch(() => {});

    // If we found relevant memories, format them as context prefix
    if (context.length > 0) {
      const contextBlock = context.map(m => `- ${m.observation}`).join('\n');
      return `[Recalled Memory]\n${contextBlock}\n\nUser: ${userMessage}`;
    }

    return userMessage;
  }

  async onResponse(agentResponse, sessionId) {
    if (!this.apiKey) return;
    this.remember(agentResponse, [`role:assistant`, `session:${sessionId}`]).catch(() => {});
  }

  // ---- Command Handlers ----

  async handleUndo(message, sessionId) {
    const countArg = parseInt(message.replace('!undo', '').trim()) || 1;
    const count = Math.min(countArg, this._writeLog.length, 10);

    if (this._writeLog.length === 0) {
      return "Nothing to undo. No memories saved this session.";
    }

    const toDelete = this._writeLog.splice(-count, count);
    let deleted = 0;
    let failed = 0;

    for (const entry of toDelete.reverse()) {
      const result = await this.forget(entry.id);
      if (result) {
        deleted++;
      } else {
        failed++;
      }
    }

    let msg = `Undid ${deleted} memor${deleted === 1 ? 'y' : 'ies'}.`;
    if (failed > 0) msg += ` (${failed} failed)`;
    msg += `\n${this._writeLog.length} more in undo history.`;
    return msg;
  }

  async handleAudit(message, sessionId) {
    const limitArg = parseInt(message.replace('!audit', '').trim()) || 10;
    const data = await this.audit(limitArg);

    if (!data || !data.entries || data.entries.length === 0) {
      return "No audit entries found.";
    }

    const lines = ["**Recent Operations:**\n"];
    for (const e of data.entries.slice(0, limitArg)) {
      const ts = new Date(e.timestamp).toLocaleTimeString();
      const hash = e.entry_hash ? e.entry_hash.slice(0, 8) : '--------';
      lines.push(`\`${ts}\` ${e.method} ${e.endpoint} → ${e.status} [${hash}]`);
    }
    lines.push(`\n*${data.total_count} total operations on record.*`);
    return lines.join('\n');
  }

  async handleStatus(message, sessionId) {
    const usageData = await this.usage();
    if (!usageData) return "Could not fetch status. Check your API key.";

    const tier = usageData.tier || 'Free';
    const memUsed = usageData.memories?.current || 0;
    const memLimit = usageData.memories?.limit || 0;
    const apiUsed = usageData.api_calls?.current || 0;
    const apiLimit = usageData.api_calls?.limit || 0;
    const pct = memLimit > 0 ? Math.round((memUsed / memLimit) * 100) : 0;

    return `**Memory Status**\n` +
           `Tier: ${tier}\n` +
           `Memories: ${memUsed} / ${memLimit} (${pct}%)\n` +
           `API Calls: ${apiUsed} / ${apiLimit}\n` +
           `Undo History: ${this._writeLog.length} writes this session`;
  }

  async handleHelp() {
    return "**Novyx Memory Commands:**\n" +
           "- `!undo [N]`: Delete last N saved memories (default: 1)\n" +
           "- `!audit [N]`: Show last N API operations (default: 10)\n" +
           "- `!status`: Memory usage and tier info\n" +
           "- `!help`: This menu\n" +
           "\nMemories are automatically recalled and saved during conversation.";
  }

  // ---- Error Handling ----

  _handleError(error, action) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      if (status === 429) {
        console.warn(`[NovyxMemory] Rate limit during ${action}. Upgrade at novyxlabs.com/pricing`);
      } else if (status === 403) {
        const code = data.code || '';
        if (code.includes('upgrade') || data.error?.toLowerCase().includes('upgrade')) {
          console.warn(`[NovyxMemory] ${data.error || 'Upgrade required'} during ${action}. Upgrade at novyxlabs.com/pricing`);
        } else {
          console.warn(`[NovyxMemory] Access forbidden during ${action}. Check your API key.`);
        }
      } else {
        console.error(`[NovyxMemory] API Error (${status}) during ${action}:`, data);
      }
    } else if (error.request) {
      console.error(`[NovyxMemory] Network Error during ${action}: ${error.message}`);
    }
  }
}

module.exports = NovyxMemory;

// CLI test
if (require.main === module) {
  const memory = new NovyxMemory();
  console.log('NovyxMemory v2 initialized');
}
