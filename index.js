const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables if .env exists
require('dotenv').config();

class NovyxMemory {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NOVYX_API_KEY;
    this.apiUrl = config.apiUrl || process.env.NOVYX_API_URL || 'https://api.novyx.ai/v1';
    this.autoSave = config.autoSave !== false; // Default true
    this.autoRecall = config.autoRecall !== false; // Default true
    this.recallLimit = config.recallLimit || 5;
    
    if (!this.apiKey) {
      console.warn('⚠️ NovyxMemory: NOVYX_API_KEY is not set. Memory features disabled.');
    }
  }

  /**
   * Save a message to Novyx.
   * @param {Object} message - { role: 'user'|'assistant', content: string, sessionId: string, metadata: object }
   */
  async save(message) {
    if (!this.apiKey || !this.autoSave) return;

    try {
      await axios.post(`${this.apiUrl}/memory`, {
        text: message.content,
        metadata: {
          role: message.role,
          session_id: message.sessionId,
          timestamp: new Date().toISOString(),
          ...message.metadata
        }
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      // console.log(`[Novyx] Saved ${message.role} message.`);
    } catch (error) {
      this._handleError(error, 'save');
    }
  }

  /**
   * Recall context based on a query.
   * @param {string} query - The search text (usually the user's latest message).
   * @param {number} limit - Number of memories to return.
   * @returns {Array} - Array of memory objects.
   */
  async recall(query, limit = this.recallLimit) {
    if (!this.apiKey || !this.autoRecall) return [];

    try {
      const response = await axios.post(`${this.apiUrl}/recall`, {
        query: query,
        limit: limit
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data.memories || [];
    } catch (error) {
      this._handleError(error, 'recall');
      return [];
    }
  }

  /**
   * Middleware hook for incoming messages.
   * Use this in your bot's message handler.
   */
  async onMessage(userMessage, sessionId) {
    // 1. Recall context
    const context = await this.recall(userMessage, this.recallLimit);
    
    // 2. Save user message (fire and forget)
    this.save({
      role: 'user',
      content: userMessage,
      sessionId: sessionId
    });

    return context;
  }

  /**
   * Middleware hook for outgoing responses.
   * Use this in your bot's response handler.
   */
  async onResponse(agentResponse, sessionId) {
    // Save agent response (fire and forget)
    this.save({
      role: 'assistant',
      content: agentResponse,
      sessionId: sessionId
    });
  }

  _handleError(error, action) {
    if (error.response) {
      const status = error.response.status;
      if (status === 429 || status === 403) {
        console.warn(`[Novyx] ⚠️ Memory limit reached during ${action}. Upgrade at novyxlabs.com/pricing`);
        // Graceful degradation: disable auto-save/recall temporarily or just log warning
        // For now, we just log and continue without crashing.
      } else {
        console.error(`[Novyx] API Error (${status}) during ${action}:`, error.response.data);
      }
    } else {
      console.error(`[Novyx] Network Error during ${action}:`, error.message);
    }
  }
}

// Export for usage
module.exports = NovyxMemory;

// If run directly (e.g. for testing)
if (require.main === module) {
  const memory = new NovyxMemory();
  console.log('Novyx Memory Middleware initialized.');
  // Example usage:
  // memory.onMessage("Hello, who are you?", "session-123").then(ctx => console.log("Context:", ctx));
}
