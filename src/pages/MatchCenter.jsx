import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { runExplanationAgent } from '../agents/explanationAgent';
import { calculateConfidenceScore } from '../agents/matchingAgent';
import { useToast } from '../components/ui/Toast';
import { usePagination } from '../hooks/usePagination';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonGrid, SkeletonRow, SkeletonHeader } from '../components/ui/Skeleton';
import {
  Sparkles, CheckCircle, XCircle, Loader, Brain,
  SortAsc, Filter, Eye, TrendingUp, Clock,
  MapPin, Tag, Palette, Calendar, X,
  ArrowUpDown, ChevronRight, Bot, ShieldCheck,
  ChevronLeft, MessageSquare
} from 'lucide-react';
import './MatchCenter.css';

/* ─── Helper: confidence → tier ────────────────────────────────────── */
const getTier = (score) => {
  if (score >= 85) return { label: 'Critical', color: '#10b981', bg: 'rgba(16,185,129,0.12)', ring: '#10b98166' };
  if (score >= 70) return { label: 'High',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', ring: '#f59e0b66' };
  if (score >= 50) return { label: 'Medium',   color: '#6366f1', bg: 'rgba(99,102,241,0.12)', ring: '#6366f166' };
  return             { label: 'Low',           color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', ring: '#94a3b866' };
};

/* ─── Arc progress ring ─────────────────────────────────────────────── */
const ScoreRing = ({ score }) => {
  const tier = getTier(score);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="score-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border-color)" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={tier.color}
          strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="score-ring-label">
        <span className="score-num">{score}</span>
        <span className="score-pct">%</span>
      </div>
    </div>
  );
};

/* ─── Comparison field row ──────────────────────────────────────────── */
const CompareRow = ({ field, lostVal, foundVal, icon: Icon }) => {
  const norm = (v) => (v || '').toLowerCase().trim();
  const match = norm(lostVal) && norm(foundVal) &&
    (norm(lostVal).includes(norm(foundVal)) || norm(foundVal).includes(norm(lostVal)));
  return (
    <tr className={`compare-row ${match ? 'match' : 'no-match'}`}>
      <td className="compare-field">
        <span className="compare-icon"><Icon size={13} /></span>
        {field}
      </td>
      <td className="compare-val lost-val">{lostVal || <span className="na">N/A</span>}</td>
      <td className="compare-status">
        {match
          ? <CheckCircle size={16} className="match-tick" />
          : <span className="dash-icon">—</span>}
      </td>
      <td className="compare-val found-val">{foundVal || <span className="na">N/A</span>}</td>
    </tr>
  );
};

/* ─── Match Detail Modal ────────────────────────────────────────────── */
const MatchDetailModal = ({ match, onClose, onConfirm, onReject }) => {
  const [explanation, setExplanation] = useState(match.explanation || null);
  const [loadingExpl, setLoadingExpl] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tier = getTier(match.confidence_score);

  const fetchExplanation = useCallback(async () => {
    if (explanation) return;
    setLoadingExpl(true);
    const res = await runExplanationAgent(match.lost_items, match.found_items, match.confidence_score);
    setExplanation(res.explanation);
    setLoadingExpl(false);
  }, [match, explanation]);

  useEffect(() => { fetchExplanation(); }, [fetchExplanation]);

  const lost = match.lost_items || {};
  const found = match.found_items || {};

  // Show chat button for all confirmed matches — figure out the other party dynamically
  const isConfirmed = match.status === 'confirmed';

  const handleOpenChat = async () => {
    if (!user?.id) { toast.error('You must be logged in.'); return; }
    setStartingChat(true);
    try {
      // Get the other participant: whoever is NOT the current user among lost/found owners
      // Fetch fresh from DB to ensure we have user_ids
      let otherUserId = null;
      let lostOwnerId = lost.user_id;
      let foundOwnerId = found.user_id;

      // If user_ids are missing from joined data, fetch them directly
      if (!lostOwnerId && match.lost_item_id) {
        const { data } = await supabase.from('lost_items').select('user_id').eq('id', match.lost_item_id).single();
        lostOwnerId = data?.user_id;
      }
      if (!foundOwnerId && match.found_item_id) {
        const { data } = await supabase.from('found_items').select('user_id').eq('id', match.found_item_id).single();
        foundOwnerId = data?.user_id;
      }

      if (user.id === lostOwnerId) {
        otherUserId = foundOwnerId;
      } else if (user.id === foundOwnerId) {
        otherUserId = lostOwnerId;
      } else {
        // Admin / third party: default to lost item owner
        otherUserId = lostOwnerId || foundOwnerId;
      }

      if (!otherUserId) {
        toast.error('Could not identify the other user. Make sure both items have owners.');
        return;
      }

      const { getOrCreateConversation } = await import('../lib/chatService');
      const conv = await getOrCreateConversation({
        lostItemId: match.lost_item_id || null,
        foundItemId: match.found_item_id || null,
        participant1: user.id,
        participant2: otherUserId,
      });

      onClose();
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      console.error('Chat error:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast.error(`Chat error: ${msg}`);
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-ai-badge">
              <Bot size={14} /> AI Analysis Report
            </div>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>
          <div className="modal-score-row">
            <ScoreRing score={match.confidence_score} />
            <div>
              <h2 className="heading-2 mb-1">Match #{match.id?.slice(0, 8)}</h2>
              <span className="tier-badge" style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.ring}` }}>
                <ShieldCheck size={13} /> {tier.label} Confidence
              </span>
              <p className="text-small mt-2">Detected {new Date(match.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="modal-section">
          <h3 className="section-heading"><ArrowUpDown size={16} /> Side-by-Side Comparison</h3>
          <div className="table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th><span className="th-lost">Lost Item</span></th>
                  <th>Match</th>
                  <th><span className="th-found">Found Item</span></th>
                </tr>
              </thead>
              <tbody>
                <CompareRow field="Title"    lostVal={lost.title}       foundVal={found.title}       icon={Tag}      />
                <CompareRow field="Category" lostVal={lost.category}    foundVal={found.category}    icon={Tag}      />
                <CompareRow field="Color"    lostVal={lost.color}       foundVal={found.color}       icon={Palette}  />
                <CompareRow field="Location" lostVal={lost.location}    foundVal={found.location}    icon={MapPin}   />
                <CompareRow field="Date"     lostVal={lost.date_lost}   foundVal={found.date_found}  icon={Calendar} />
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Explanation */}
        <div className="modal-section">
          <h3 className="section-heading"><Sparkles size={16} /> AI Similarity Explanation</h3>
          <div className="explanation-panel">
            {loadingExpl ? (
              <div className="expl-loading">
                <Loader size={18} className="spin" />
                <span>Groq LLM is generating explanation...</span>
              </div>
            ) : (
              <div className="expl-text">
                <Bot size={18} className="expl-icon" />
                <p>{explanation}</p>
              </div>
            )}
          </div>
        </div>

        {/* Confirm / Reject Actions for pending matches */}
        {match.status === 'pending' && (
          <div className="modal-actions">
            <button onClick={() => { onReject(match.id); onClose(); }}
              className="btn-secondary flex items-center gap-2" style={{ color: 'var(--danger)' }}>
              <XCircle size={18} /> Reject Match
            </button>
            <button onClick={() => { onConfirm(match.id); onClose(); }} className="btn-primary flex items-center gap-2">
              <CheckCircle size={18} /> Confirm Match
            </button>
          </div>
        )}

        {/* Chat button — always shown, enabled only when confirmed */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1rem' }}>
          {isConfirmed ? (
            <button
              className="btn-primary flex items-center justify-center gap-2"
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={handleOpenChat}
              disabled={startingChat}
            >
              {startingChat
                ? <><Loader size={18} className="spin" /> Opening Chat...</>
                : <><MessageSquare size={18} /> Open Chat</>
              }
            </button>
          ) : (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              💬 Chat becomes available after confirming this match
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Main Match Center ─────────────────────────────────────────────── */
const MatchCenter = () => {
  const toast = useToast();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('confidence'); // confidence | newest
  const [filterStatus, setFilterStatus] = useState('all'); // all | pending | confirmed | rejected
  const [selectedMatch, setSelectedMatch] = useState(null);

  const stats = {
    total:     matches.length,
    pending:   matches.filter(m => m.status === 'pending').length,
    confirmed: matches.filter(m => m.status === 'confirmed').length,
    highConf:  matches.filter(m => m.confidence_score >= 80).length,
  };

  useEffect(() => { fetchMatches(); }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      // Fetch matches without foreign key joins first to avoid relation errors
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*');
      
      if (matchesError) throw matchesError;

      if (!matchesData || matchesData.length === 0) {
        setMatches([]);
        return;
      }

      // Extract unique IDs
      const lostIds = [...new Set(matchesData.map(m => m.lost_item_id).filter(Boolean))];
      const foundIds = [...new Set(matchesData.map(m => m.found_item_id).filter(Boolean))];

      // Fetch related items manually
      const [ { data: lostData }, { data: foundData } ] = await Promise.all([
        supabase.from('lost_items').select('*').in('id', lostIds),
        supabase.from('found_items').select('*').in('id', foundIds)
      ]);

      // Merge data
      const mergedData = matchesData.map(m => ({
        ...m,
        lost_items: (lostData || []).find(l => l.id === m.lost_item_id) || {},
        found_items: (foundData || []).find(f => f.id === m.found_item_id) || {},
        explanation: null
      }));

      setMatches(mergedData);
    } catch (err) {
      console.error('Error fetching matches:', err);
      toast.error('Failed to load matches. Database relation error.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    await supabase.from('matches').update({ status: 'confirmed' }).eq('id', id);
    setMatches(prev => prev.map(m => m.id === id ? { ...m, status: 'confirmed' } : m));
  };

  const handleReject = async (id) => {
    await supabase.from('matches').update({ status: 'rejected' }).eq('id', id);
    setMatches(prev => prev.map(m => m.id === id ? { ...m, status: 'rejected' } : m));
  };

  /* Apply sort + filter */
  const displayed = matches
    .filter(m => filterStatus === 'all' || m.status === filterStatus)
    .sort((a, b) => sortBy === 'confidence'
      ? b.confidence_score - a.confidence_score
      : new Date(b.created_at) - new Date(a.created_at));

  const { paged, page, totalPages, hasPrev, hasNext, prev, next, goTo } = usePagination(displayed, 10);

  if (loading) {
    return (
      <div className="mc-page animate-fade-in">
        <SkeletonHeader />
        <div className="mc-stats" style={{ marginTop: '1.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: '90px' }}><SkeletonGrid count={1} /></div>)}
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: '180px' }}><SkeletonGrid count={1} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="mc-page animate-fade-in">

      {/* ── Page Header ── */}
      <div className="mc-header">
        <div className="mc-header-left">
          <div className="mc-header-icon"><Brain size={24} /></div>
          <div>
            <h1 className="heading-2">AI Match Center</h1>
            <p className="text-body">Matches auto-detected by the AI agent pipeline</p>
          </div>
        </div>
        <button onClick={fetchMatches} className="btn-secondary flex items-center gap-2">
          <Sparkles size={16} /> Refresh
        </button>
      </div>

      {/* ── Stats Strip ── */}
      <div className="mc-stats">
        {[
          { label: 'Total Matches',  value: stats.total,     color: 'var(--primary)' },
          { label: 'Pending Review', value: stats.pending,   color: 'var(--warning)' },
          { label: 'Confirmed',      value: stats.confirmed, color: 'var(--success)' },
          { label: 'High Confidence (≥80%)', value: stats.highConf, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="mc-stat-card glass">
            <span className="mc-stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="mc-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="mc-controls glass">
        <div className="mc-controls-left">
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-small font-medium">Filter:</span>
          {['all', 'pending', 'confirmed', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`mc-filter-btn ${filterStatus === f ? 'active' : ''}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="mc-controls-right">
          <SortAsc size={16} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-small font-medium">Sort:</span>
          <button onClick={() => setSortBy('confidence')}
            className={`mc-filter-btn ${sortBy === 'confidence' ? 'active' : ''}`}>
            <TrendingUp size={13} /> Highest Confidence
          </button>
          <button onClick={() => setSortBy('newest')}
            className={`mc-filter-btn ${sortBy === 'newest' ? 'active' : ''}`}>
            <Clock size={13} /> Newest First
          </button>
        </div>
      </div>

      {/* ── Match List ── */}
      {displayed.length === 0 ? (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)' }}>
          <EmptyState 
            icon={Brain} 
            title="No matches found" 
            description={filterStatus !== 'all' ? `No ${filterStatus} matches. Try a different filter.` : 'Submit lost/found items and the AI will auto-detect matches.'} 
          />
        </div>
      ) : (
        <>
          <div className="mc-list">
            {paged.map(match => {
              const tier = getTier(match.confidence_score);
              const lost = match.lost_items || {};
              const found = match.found_items || {};
              return (
                <div key={match.id} className={`mc-card glass ${match.status}`}
                  style={{ '--tier-color': tier.color, '--tier-bg': tier.bg, '--tier-ring': tier.ring }}>

                  {/* Card header */}
                  <div className="mc-card-header">
                    <div className="mc-card-score-wrap">
                      <ScoreRing score={match.confidence_score} />
                      <div className="mc-card-score-info">
                        <span className="tier-badge" style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.ring}` }}>
                          <ShieldCheck size={11} /> {tier.label} Confidence
                        </span>
                        <p className="text-small mt-1">
                          <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
                          {new Date(match.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mc-card-header-right">
                      <span className={`status-pill ${match.status}`}>{match.status}</span>
                      <button onClick={() => setSelectedMatch(match)} className="view-detail-btn">
                        <Eye size={15} /> View Detail <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Items comparison preview */}
                  <div className="mc-card-body">
                    <div className="mc-item-preview lost">
                      <div className="preview-label-lost">Lost Item</div>
                      <div className="preview-title">{lost.title || 'Unknown'}</div>
                      <div className="preview-meta">
                        {lost.category && <span><Tag size={11} />{lost.category}</span>}
                        {lost.color    && <span><Palette size={11} />{lost.color}</span>}
                        {lost.location && <span><MapPin size={11} />{lost.location}</span>}
                      </div>
                    </div>

                    <div className="mc-vs-col">
                      <div className="mc-vs-ring" style={{ borderColor: tier.color, color: tier.color }}>
                        <Sparkles size={16} />
                      </div>
                      <div className="mc-vs-line" style={{ backgroundColor: tier.color + '33' }} />
                    </div>

                    <div className="mc-item-preview found">
                      <div className="preview-label-found">Found Item</div>
                      <div className="preview-title">{found.title || 'Unknown'}</div>
                      <div className="preview-meta">
                        {found.category && <span><Tag size={11} />{found.category}</span>}
                        {found.color    && <span><Palette size={11} />{found.color}</span>}
                        {found.location && <span><MapPin size={11} />{found.location}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {match.status === 'pending' && (
                    <div className="mc-card-actions">
                      <button onClick={() => handleReject(match.id)}
                        className="btn-secondary flex items-center gap-1" style={{ color: 'var(--danger)', fontSize: '0.85rem', padding: '0.5rem 0.875rem' }}>
                        <XCircle size={15} /> Reject
                      </button>
                      <button onClick={() => handleConfirm(match.id)}
                        className="btn-primary flex items-center gap-1" style={{ fontSize: '0.85rem', padding: '0.5rem 0.875rem' }}>
                        <CheckCircle size={15} /> Confirm
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="pagination" role="navigation" aria-label="Pagination">
              <button onClick={prev} disabled={!hasPrev} className="pagination-btn" aria-label="Previous page">
                <ChevronLeft size={16} />
              </button>
              <button onClick={next} disabled={!hasNext} className="pagination-btn" aria-label="Next page">
                <ChevronRight size={16} />
              </button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
            </nav>
          )}
        </>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onConfirm={(id) => { handleConfirm(id); setSelectedMatch(prev => prev ? { ...prev, status: 'confirmed' } : null); }}
          onReject={(id) => { handleReject(id); setSelectedMatch(prev => prev ? { ...prev, status: 'rejected' } : null); }}
        />
      )}
    </div>
  );
};

export default MatchCenter;
