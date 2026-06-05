import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { SkeletonGrid, SkeletonRow, SkeletonHeader } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { usePagination } from '../hooks/usePagination';
import {
  ShieldCheck, CheckCircle, XCircle, Loader,
  Brain, Users, Activity, AlertTriangle,
  Eye, Package, BarChart3, ChevronLeft, ChevronRight
} from 'lucide-react';
import './AdminDashboard.css';

/* ── Verdict color helper ─────────────────────────────────────────── */
const verdictConfig = {
  verified:   { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Verified'   },
  likely:     { color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'Likely'     },
  uncertain:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Uncertain'  },
  suspicious: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Suspicious' },
};

const AdminDashboard = () => {
  const toast = useToast();
  const [stats, setStats] = useState({ lost: 0, found: 0, matches: 0, claims: 0 });
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [
        { count: lostCount },
        { count: foundCount },
        { count: matchCount },
        { count: claimCount },
        { data: claimsData },
      ] = await Promise.all([
        supabase.from('lost_items').select('*', { count: 'exact', head: true }),
        supabase.from('found_items').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('claims').select('*', { count: 'exact', head: true }),
        supabase.from('claims').select(`
          *,
          claimant:claimant_id(name, email),
          owner:owner_id(name, email)
        `).order('created_at', { ascending: false }),
      ]);

      setStats({ lost: lostCount || 0, found: foundCount || 0, matches: matchCount || 0, claims: claimCount || 0 });
      setClaims(claimsData || []);
    } catch (err) {
      toast.error('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleClaimAction = async (claimId, action, ownerId, claimantId, itemType) => {
    setActionLoading(claimId + action);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await supabase.from('claims').update({ status: newStatus, reviewed_at: new Date().toISOString() }).eq('id', claimId);

      // Notify claimant
      const claim = claims.find(c => c.id === claimId);
      const itemTitle = claim?.item_title || 'your claimed item';
      await supabase.from('notifications').insert([{
        user_id: claimantId,
        message: action === 'approve'
          ? `✅ Your claim has been APPROVED by the admin! The owner will contact you shortly.`
          : `❌ Your claim was rejected by the admin. If you believe this is a mistake, please contact support.`,
        is_read: false,
      }]);

      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c));
      if (selectedClaim?.id === claimId) setSelectedClaim(prev => ({ ...prev, status: newStatus }));
      toast.success(`Claim ${action === 'approve' ? 'approved' : 'rejected'} successfully.`);
    } catch (err) {
      toast.error('Failed to update claim status.');
    } finally {
      setActionLoading('');
    }
  };

  const pendingClaims = claims.filter(c => c.status === 'pending_review');
  const { paged, page, totalPages, hasPrev, hasNext, prev, next, goTo } = usePagination(claims, 10);

  if (loading) {
    return (
      <div className="admin-page animate-fade-in">
        <SkeletonHeader />
        <div className="admin-stats mt-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: '90px' }}><SkeletonGrid count={1} /></div>)}
        </div>
        <div className="mt-6 flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-icon" aria-hidden="true"><ShieldCheck size={24} /></div>
          <div>
            <h1 className="heading-2">Admin Control Center</h1>
            <p className="text-body">System overview &amp; claim management</p>
          </div>
        </div>
        <button onClick={fetchAll} className="btn-secondary flex items-center gap-2" aria-label="Refresh admin data">
          <Activity size={16} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        {[
          { label: 'Lost Items',     value: stats.lost,    icon: Package,    color: 'var(--danger)'   },
          { label: 'Found Items',    value: stats.found,   icon: Package,    color: 'var(--success)'  },
          { label: 'AI Matches',     value: stats.matches, icon: Brain,      color: 'var(--primary)'  },
          { label: 'Total Claims',   value: stats.claims,  icon: Users,      color: 'var(--accent)'   },
          { label: 'Pending Review', value: pendingClaims.length, icon: AlertTriangle, color: 'var(--warning)' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="admin-stat-card glass">
              <div className="admin-stat-icon" style={{ color: s.color, backgroundColor: s.color + '18' }} aria-hidden="true">
                <Icon size={20} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-value" style={{ color: s.color }}>{s.value}</span>
                <span className="admin-stat-label">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="admin-tabs glass" role="tablist">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'claims',   label: `Claims ${pendingClaims.length > 0 ? `(${pendingClaims.length} pending)` : ''}`, icon: ShieldCheck },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`admin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              role="tab" aria-selected={activeTab === t.id}>
              <Icon size={16} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="admin-section glass animate-fade-in" role="tabpanel">
          <h3 className="section-heading-admin">System Operations</h3>
          <div className="flex gap-4 flex-wrap">
            <button className="btn-primary flex items-center gap-2" onClick={() => toast.info('AI sync initiated')}>
              <Brain size={18} /> Force AI Sync
            </button>
            <button className="btn-secondary flex items-center gap-2" onClick={() => toast.success('Reports exported')}>
              <BarChart3 size={18} /> Export Reports
            </button>
            <button className="btn-secondary flex items-center gap-2" style={{ color: 'var(--danger)' }} onClick={() => toast.warning('Action requires root approval')}>
              <XCircle size={18} /> Purge Old Records
            </button>
          </div>
        </div>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <div className="admin-claims-wrap animate-fade-in" role="tabpanel">
          {/* Claims list */}
          <div className="claims-list">
            <h3 className="section-heading-admin">Claim History ({claims.length})</h3>
            {claims.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No claims submitted" description="There are no claims to review at this time." />
            ) : (
              <>
                {paged.map(claim => {
                  const vc = verdictConfig[claim.ai_verdict] || verdictConfig.uncertain;
                  return (
                    <div
                      key={claim.id}
                      onClick={() => setSelectedClaim(claim)}
                      className={`claim-row glass ${selectedClaim?.id === claim.id ? 'selected' : ''} ${claim.status}`}
                      role="button" aria-pressed={selectedClaim?.id === claim.id} tabIndex={0}
                    >
                      <div className="claim-row-left">
                        <div className="claim-row-meta">
                          <span className={`claim-status-pill ${claim.status}`}>{claim.status.replace('_', ' ')}</span>
                          <span className="text-small">{new Date(claim.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="claim-row-claimant">
                          <strong>{claim.claimant?.name || 'Unknown'}</strong>
                          <span> claims a {claim.item_type} item</span>
                        </p>
                        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Owner: {claim.owner?.name || 'Unknown'}</p>
                      </div>
                      <div className="claim-row-right">
                        {claim.verification_score !== null && (
                          <div className="claim-score-wrap">
                            <span className="claim-score-num" style={{ color: vc.color }}>{claim.verification_score}</span>
                            <span className="claim-score-label">/100</span>
                            <span className="claim-verdict-badge" style={{ background: vc.bg, color: vc.color }}>{vc.label}</span>
                          </div>
                        )}
                        <Eye size={16} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                      </div>
                    </div>
                  );
                })}

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
          </div>

          {/* Detail panel */}
          {selectedClaim && (
            <div className="claim-detail-panel glass animate-fade-in" aria-live="polite">
              <div className="flex justify-between items-center mb-4">
                <h3 className="section-heading-admin" style={{ margin: 0 }}>Claim Detail</h3>
                <button className="btn-icon" onClick={() => setSelectedClaim(null)} aria-label="Close detail"><XCircle size={18} /></button>
              </div>

              <div className="detail-meta-grid">
                <div><span className="dm-label">Claimant</span><p className="dm-val">{selectedClaim.claimant?.name || '—'}</p></div>
                <div><span className="dm-label">Email</span><p className="dm-val">{selectedClaim.claimant?.email || '—'}</p></div>
                <div><span className="dm-label">Item Type</span><p className="dm-val" style={{ textTransform: 'capitalize' }}>{selectedClaim.item_type}</p></div>
                <div><span className="dm-label">Submitted</span><p className="dm-val">{new Date(selectedClaim.created_at).toLocaleString()}</p></div>
              </div>

              {/* Verification Score */}
              {selectedClaim.verification_score !== null && (
                <div className="detail-score-banner" style={{
                  backgroundColor: (verdictConfig[selectedClaim.ai_verdict] || verdictConfig.uncertain).bg,
                  color: (verdictConfig[selectedClaim.ai_verdict] || verdictConfig.uncertain).color,
                  borderColor: (verdictConfig[selectedClaim.ai_verdict] || verdictConfig.uncertain).color + '44'
                }}>
                  <span className="dsb-score">{selectedClaim.verification_score}/100</span>
                  <div>
                    <p className="dsb-verdict">{(verdictConfig[selectedClaim.ai_verdict] || verdictConfig.uncertain).label}</p>
                    <p className="dsb-reasoning">{selectedClaim.ai_reasoning}</p>
                  </div>
                </div>
              )}

              {/* Questions & Answers */}
              {selectedClaim.questions?.length > 0 && (
                <div className="detail-qa">
                  <h4 className="dm-label mb-3">Questions &amp; Answers</h4>
                  {selectedClaim.questions.map((q, i) => {
                    const pq = selectedClaim.per_question_scores?.[i];
                    return (
                      <div key={i} className="detail-qa-row glass">
                        <p className="dqa-q"><strong>Q{i+1}:</strong> {q}</p>
                        <p className="dqa-a"><strong>Answer:</strong> {selectedClaim.answers?.[i] || '—'}</p>
                        {pq && <p className="dqa-comment">AI: {pq.comment} <strong>({pq.score}/10)</strong></p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Admin Actions */}
              {selectedClaim.status === 'pending_review' && (
                <div className="detail-actions">
                  <button
                    onClick={() => handleClaimAction(selectedClaim.id, 'reject', selectedClaim.owner_id, selectedClaim.claimant_id, selectedClaim.item_type)}
                    disabled={!!actionLoading}
                    className="btn-secondary flex items-center gap-2" style={{ color: 'var(--danger)', flex: 1 }}>
                    {actionLoading === selectedClaim.id + 'reject' ? <Loader size={16} className="spin" /> : <XCircle size={16} />}
                    Reject Claim
                  </button>
                  <button
                    onClick={() => handleClaimAction(selectedClaim.id, 'approve', selectedClaim.owner_id, selectedClaim.claimant_id, selectedClaim.item_type)}
                    disabled={!!actionLoading}
                    className="btn-primary flex items-center gap-2" style={{ flex: 1 }}>
                    {actionLoading === selectedClaim.id + 'approve' ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                    Approve Claim
                  </button>
                </div>
              )}
              {selectedClaim.status !== 'pending_review' && (
                <div className={`detail-resolved-banner ${selectedClaim.status}`}>
                  {selectedClaim.status === 'approved'
                    ? <><CheckCircle size={18} /> This claim was approved.</>
                    : <><XCircle size={18} /> This claim was rejected.</>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
