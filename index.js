#!/usr/bin/env node
/**
 * Novyx Memory - v2 SDK Integration
 * 
 * Native persistent memory layer for AI agents.
 * Handles rate limits (429) and forbidden (403) gracefully.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables if .env exists
require('dotenv').config();

class NovyxMemory {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://novyx-ram-api.fly.dev';
    this.autoSave = config.autoSave !== false; // Default true
    this.autoRecall = config.autoRecall !== false; // Default true
    this.recallLimit = config.recallLimit || 5;
    
    if (!this.apiKey) {
      console.warn('⚠️ NovyxMemory: NOVYX_API_KEY is not set. Memory features disabled.');
    }
  }

  /**
   * Save a memory to Novyx
   */
  async remember(observation, tags = []) {
    if (!this.apiKey || !this.autoSave) return null;

    try {
      const response = await axios.post(`${this.apiUrl}/v1/memories`, {
        observation: observation,
        tags: tags
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'remember');
      return null;
    }
  }

  /**
   * Delete a specific memory by ID
   */
  async forget(memoryId) {
    if (!this.apiKey) return null;

    try {
      const response = await axios.delete(`${this.apiUrl}/v1/memories/${memoryId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'forget');
      return null;
    }
  }

  /**
   * Search memories semantically
   */
  async recall(query, limit = this.recallLimit) {
    if (!this.apiKey || !this.autoRecall) return [];

    try {
      const response = await axios.get(`${this.apiUrl}/v1/memories/search`, {
        params: { q: query, limit: limit },
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data.memories || [];
    } catch (error) {
      this._handleError(error, 'recall');
      return [];
    }
  }

  /**
   * Get memory statistics
   */
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

  /**
   * List memory edges (graph relationships)
   * @param {Object} opts - Optional filters
   * @param {string} opts.memory_id - Filter edges by a specific memory ID (source or target)
   * @param {string} opts.relation - Filter by relation type (e.g. 'auto_related')
   * @param {number} opts.limit - Max edges to return (default 100)
   * @param {number} opts.offset - Pagination offset (default 0)
   */
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

  /**
   * Get current usage and tier limits
   */
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

  /**
   * Handle errors with proper messaging
   */
  _handleError(error, action) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};
      
      if (status === 429) {
        console.warn(`[Novyx] ⚠️ Rate limit during ${action}. Upgrade at novyxlabs.com/pricing`);
      } else if (status === 403) {
        const code = data.code || '';
        if (code.includes('upgrade') || data.error?.toLowerCase().includes('upgrade')) {
          console.warn(`[Novyx] ⚠️ ${data.error || 'Upgrade required'} during ${action}. Upgrade at novyxlabs.com/pricing`);
        } else {
          console.warn(`[Novyx] ⚠️ Access forbidden during ${action}. Check your API key.`);
        }
      } else {
        console.error(`[Novyx] API Error (${status}) during ${action}:`, data);
      }
    } else if (error.request) {
      console.error(`[Novyx] Network Error during ${action}: ${error.message}`);
    }
  }

  /**
   * Middleware: On incoming user message
   */
  async onMessage(userMessage, sessionId) {
    const context = await this.recall(userMessage, this.recallLimit);
    
    // Fire and forget save
    this.remember(userMessage, [`role:user`, `session:${sessionId}`]).catch(() => {});
    
    return context;
  }

  /**
   * Middleware: On agent response
   */
  async onResponse(agentResponse, sessionId) {
    this.remember(agentResponse, [`role:assistant`, `session:${sessionId}`]).catch(() => {});
  }
}

module.exports = NovyxMemory;

// CLI test
if (require.main === module) {
  const memory = new NovyxMemory();
  console.log('✅ NovyxMemory v2 initialized');
}
