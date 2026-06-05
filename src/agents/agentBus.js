/**
 * Agent Activity Bus
 * ---------------------------------------------------------
 * A lightweight global event emitter that:
 *  1. Collects agent events in memory (for the live panel)
 *  2. Persists them to Supabase `agent_logs` table (for history)
 *  3. Broadcasts to subscribers so any UI component can react
 *
 * Usage:
 *   import { agentBus } from './agentBus';
 *   agentBus.emit({ agent: 'MatchingAgent', status: 'running', message: 'Searching DB...' });
 *   const unsub = agentBus.subscribe(event => setLog(prev => [...prev, event]));
 */

import { supabase } from '../lib/supabase';

// ── Event types ─────────────────────────────────────────────
export const AGENT_STATUS = {
  START:   'start',
  RUNNING: 'running',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR:   'error',
  INFO:    'info',
};

// ── Agent meta (icon, color, label) ─────────────────────────
export const AGENT_META = {
  Pipeline:           { label: 'Orchestrator',        color: '#6366f1', icon: '🧠' },
  ItemAnalysisAgent:  { label: 'Item Analysis',       color: '#8b5cf6', icon: '🔬' },
  MatchingAgent:      { label: 'Matching Agent',       color: '#06b6d4', icon: '🔍' },
  NotificationAgent:  { label: 'Notification Agent',  color: '#f59e0b', icon: '🔔' },
  ExplanationAgent:   { label: 'Explanation Agent',   color: '#10b981', icon: '💡' },
  VerificationAgent:  { label: 'Verification Agent',  color: '#ef4444', icon: '🛡️' },
  ClaimAgent:         { label: 'Claim Agent',         color: '#ec4899', icon: '📋' },
};

// ── In-memory log ────────────────────────────────────────────
let log = [];
let subscribers = [];
let logId = 0;

const agentBus = {
  /**
   * Emit an agent activity event.
   * @param {{ agent: string, status: string, message: string, data?: any, sessionId?: string }} event
   */
  emit(event) {
    const entry = {
      id: ++logId,
      agent: event.agent || 'Pipeline',
      status: event.status || AGENT_STATUS.INFO,
      message: event.message,
      data: event.data || null,
      sessionId: event.sessionId || null,
      timestamp: new Date().toISOString(),
    };

    // Add to in-memory log (cap at 200 entries)
    log = [entry, ...log].slice(0, 200);

    // Notify all subscribers
    subscribers.forEach(fn => fn(entry));

    // Persist to Supabase asynchronously (fire and forget)
    supabase.from('agent_logs').insert([{
      agent:      entry.agent,
      status:     entry.status,
      message:    entry.message,
      session_id: entry.sessionId,
      payload:    entry.data ? JSON.stringify(entry.data) : null,
      created_at: entry.timestamp,
    }]).then(({ error }) => {
      if (error && !error.message?.includes('does not exist')) {
        console.warn('[AgentBus] Could not persist log:', error.message);
      }
    });

    return entry;
  },

  /** Subscribe to new events. Returns an unsubscribe function. */
  subscribe(fn) {
    subscribers.push(fn);
    return () => { subscribers = subscribers.filter(s => s !== fn); };
  },

  /** Get current in-memory log snapshot */
  getLog() { return [...log]; },

  /** Clear in-memory log */
  clear() { log = []; subscribers.forEach(fn => fn(null)); },
};

export { agentBus };
