import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { agentBus, AGENT_META, AGENT_STATUS } from '../agents/agentBus';
import {
  Brain, RefreshCw, Trash2, Download,
  CheckCircle, XCircle, AlertTriangle, Loader,
  Info, Zap, Filter
} from 'lucide-react';
import './AIActivity.css';

/* ── Status config ─────────────────────────────────────────── */
const STATUS_CFG = {
  [AGENT_STATUS.START]:   { color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   icon: <Zap size={11} />,          label: 'START'   },
  [AGENT_STATUS.RUNNING]: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   icon: <Loader size={11} />,       label: 'RUNNING' },
  [AGENT_STATUS.SUCCESS]: { color: '#10b981', bg: 'rgba(16,185,129,0.12)',   icon: <CheckCircle size={11} />,  label: 'SUCCESS' },
  [AGENT_STATUS.WARNING]: { color: '#f97316', bg: 'rgba(249,115,22,0.12)',   icon: <AlertTriangle size={11} />,label: 'WARN'    },
  [AGENT_STATUS.ERROR]:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: <XCircle size={11} />,      label: 'ERROR'   },
  [AGENT_STATUS.INFO]:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)',  icon: <Info size={11} />,         label: 'INFO'    },
};

const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ── Single Timeline Event ─────────────────────────────────── */
const TimelineItem = ({ event, showData }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = AGENT_META[event.agent] || { label: event.agent, color: '#6366f1', icon: '🤖' };
  const sCfg = STATUS_CFG[event.status] || STATUS_CFG[AGENT_STATUS.INFO];

  return (
    <div className="timeline-item" onClick={() => setExpanded(e => !e)}>
      {/* Icon Node */}
      <div
        className={`tl-node ${event.status}`}
        style={{ borderColor: meta.color, color: meta.color }}
      >
        {meta.icon}
      </div>

      {/* Content Bubble */}
      <div className="tl-content" style={{ cursor: event.data ? 'pointer' : 'default' }}>
        <div className="tl-top">
          <span className="tl-agent-name" style={{ color: meta.color }}>{meta.label}</span>
          <span
            className="tl-status-pill"
            style={{ background: sCfg.bg, color: sCfg.color }}
          >
            {sCfg.icon} {sCfg.label}
          </span>
          <span className="tl-time">{fmtTime(event.timestamp)}</span>
        </div>
        <p className="tl-message">{event.message}</p>
        {event.data && expanded && (
          <pre className="tl-data">{JSON.stringify(event.data, null, 2)}</pre>
        )}
        {event.data && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
            {expanded ? '▲ Hide data' : '▼ Show payload'}
          </span>
        )}
      </div>
    </div>
  );
};

/* ── Agent Status Card ─────────────────────────────────────── */
const AgentCard = ({ agentKey, events }) => {
  const meta = AGENT_META[agentKey];
  const agentEvents = events.filter(e => e.agent === agentKey);
  const lastEvent = agentEvents[0];
  const status = lastEvent?.status || 'idle';
  const isActive = status === AGENT_STATUS.RUNNING || status === AGENT_STATUS.START;
  const isSuccess = status === AGENT_STATUS.SUCCESS;
  const isError = status === AGENT_STATUS.ERROR;

  const statusColor = isActive ? '#f59e0b' : isSuccess ? '#10b981' : isError ? '#ef4444' : 'var(--text-secondary)';
  const statusLabel = isActive ? '● Running' : isSuccess ? '✓ Done' : isError ? '✗ Error' : '○ Idle';
  const runCount = agentEvents.filter(e => e.status === AGENT_STATUS.SUCCESS).length;

  return (
    <div className={`agent-card ${isActive ? 'active' : ''}`}>
      <div className="agent-card-header">
        <div className="agent-card-emoji">{meta.icon}</div>
        <div>
          <div className="agent-card-name">{meta.label}</div>
          <div className="agent-card-status" style={{ color: statusColor }}>
            {statusLabel} · {runCount} run{runCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="agent-card-bar">
        <div
          className="agent-card-bar-fill"
          style={{
            width: isActive ? '60%' : isSuccess ? '100%' : isError ? '100%' : '0%',
            backgroundColor: statusColor,
            animation: isActive ? 'loadingBar 1.2s ease-in-out infinite alternate' : 'none'
          }}
        />
      </div>
      {lastEvent && (
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.4 }}>
          {lastEvent.message.slice(0, 70)}{lastEvent.message.length > 70 ? '…' : ''}
        </p>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN AI ACTIVITY PAGE
══════════════════════════════════════════════════════════════ */
const AIActivity = () => {
  const [events, setEvents] = useState(() => agentBus.getLog());
  const [filter, setFilter] = useState('all');   // all | agent name
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // Subscribe to live events
  useEffect(() => {
    const unsub = agentBus.subscribe(entry => {
      if (!entry) return;
      setEvents(agentBus.getLog());
    });
    return unsub;
  }, []);

  // Load historical logs from Supabase on mount
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data?.length) {
        // Merge DB history with in-memory (deduplicate by id)
        const mapped = data.map((row, idx) => ({
          id: `db_${row.id || idx}`,
          agent: row.agent,
          status: row.status,
          message: row.message,
          data: row.payload ? JSON.parse(row.payload) : null,
          sessionId: row.session_id,
          timestamp: row.created_at,
        }));

        // Insert into bus memory (without re-emitting to Supabase)
        setEvents(prev => {
          const existing = new Set(prev.map(e => e.message + e.timestamp));
          const newOnes = mapped.filter(m => !existing.has(m.message + m.timestamp));
          return [...prev, ...newOnes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 200);
        });
      }
    } catch (err) {
      // agent_logs table might not exist yet — silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleClear = () => {
    agentBus.clear();
    setEvents([]);
  };

  const handleExport = () => {
    const json = JSON.stringify(events, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered events
  const filtered = events.filter(e => {
    if (filter !== 'all' && e.agent !== filter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total:    events.length,
    success:  events.filter(e => e.status === AGENT_STATUS.SUCCESS).length,
    running:  events.filter(e => e.status === AGENT_STATUS.RUNNING || e.status === AGENT_STATUS.START).length,
    errors:   events.filter(e => e.status === AGENT_STATUS.ERROR).length,
    agents:   Object.keys(AGENT_META).length,
  };

  const agentKeys = Object.keys(AGENT_META);

  return (
    <div className="ai-activity-page animate-fade-in">
      {/* ── Header ── */}
      <div className="aap-header">
        <div className="aap-header-left">
          <div className="aap-header-icon">🧠</div>
          <div>
            <h1 className="heading-2">AI Pipeline Activity</h1>
            <p className="text-small">Real-time view of all Agentic AI actions</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="live-dot">LIVE</span>
          <button onClick={loadHistory} disabled={loading} className="btn-secondary flex items-center gap-2">
            {loading ? <Loader size={15} className="spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download size={15} /> Export
          </button>
          <button onClick={handleClear} className="btn-secondary flex items-center gap-2" style={{ color: 'var(--danger)' }}>
            <Trash2 size={15} /> Clear
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="aap-stats">
        {[
          { label: 'Total Events',  value: stats.total,   color: 'var(--primary)' },
          { label: 'Successful',    value: stats.success, color: '#10b981' },
          { label: 'Running',       value: stats.running, color: '#f59e0b' },
          { label: 'Errors',        value: stats.errors,  color: '#ef4444' },
          { label: 'Active Agents', value: stats.agents,  color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="aap-stat-card glass">
            <span className="aap-stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="aap-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="aap-filters glass">
        <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Agent:</span>
        {['all', ...agentKeys].map(k => (
          <button
            key={k}
            className={`aap-filter-btn ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(k)}
          >
            {k === 'all' ? 'All Agents' : (AGENT_META[k]?.icon + ' ' + AGENT_META[k]?.label)}
          </button>
        ))}
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginLeft: '0.5rem' }}>Status:</span>
        {['all', ...Object.keys(AGENT_STATUS)].map(k => (
          <button
            key={k}
            className={`aap-filter-btn ${statusFilter === (k === 'all' ? 'all' : AGENT_STATUS[k]) ? 'active' : ''}`}
            onClick={() => setStatusFilter(k === 'all' ? 'all' : AGENT_STATUS[k])}
          >
            {k === 'all' ? 'All' : k}
          </button>
        ))}
      </div>

      {/* ── Layout: Timeline + Agent Cards ── */}
      <div className="aap-layout">
        {/* Timeline */}
        <div className="timeline-wrap">
          {filtered.length === 0 ? (
            <div className="aap-empty glass" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className="aap-empty-icon">🤖</div>
              <h3 className="heading-3">No Agent Activity Yet</h3>
              <p className="text-body" style={{ maxWidth: 340, margin: '0.5rem auto 0' }}>
                Submit a lost or found item to see the AI agents spring into action in real-time!
              </p>
            </div>
          ) : (
            <div className="timeline-list">
              {filtered.map(event => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        {/* Agent Status Cards */}
        <div className="agent-cards">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Agent Status
          </h3>
          {agentKeys.map(key => (
            <AgentCard key={key} agentKey={key} events={events} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIActivity;
