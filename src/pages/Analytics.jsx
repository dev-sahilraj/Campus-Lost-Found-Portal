import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadialBarChart, RadialBar,
  AreaChart, Area, ScatterChart, Scatter, ZAxis, FunnelChart, Funnel, LabelList,
  ComposedChart
} from 'recharts';
import { supabase } from '../lib/supabase';
import { runInsightsAgent } from '../agents/insightsAgent';
import {
  BarChart3, Brain, Sparkles, Loader, RefreshCw,
  TrendingUp, TrendingDown, Package, CheckCircle,
  MapPin, Tag, Activity, Lightbulb, Clock,
  Users, Target, Zap, AlertTriangle, Trophy, Star,
  ArrowRight, Shield
} from 'lucide-react';
import './Analytics.css';

/* ─── Palette ───────────────────────────────────────────────── */
const COLORS   = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];
const GRADIENT = ['#6366f1','#8b5cf6','#a78bfa'];

/* ─── Custom Tooltip ─────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tt-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="tt-val" style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/* ─── KPI Card ───────────────────────────────────────────────── */
const KPICard = ({ label, value, sub, icon: Icon, color, trend, trendLabel }) => (
  <div className="kpi-card glass">
    <div className="kpi-icon" style={{ backgroundColor: color + '18', color }}><Icon size={22} /></div>
    <div className="kpi-body">
      <span className="kpi-value" style={{ color }}>{value}</span>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
    {trend !== undefined && (
      <div className={`kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
        {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{Math.abs(trend)}% {trendLabel || 'vs last month'}</span>
      </div>
    )}
  </div>
);

/* ─── Chart Wrapper ──────────────────────────────────────────── */
const ChartCard = ({ title, subtitle, children, className = '', badge }) => (
  <div className={`chart-card glass ${className}`}>
    <div className="chart-card-header">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 className="chart-title">{title}</h3>
          {badge && <span className="chart-badge">{badge}</span>}
        </div>
        {subtitle && <p className="chart-subtitle">{subtitle}</p>}
      </div>
    </div>
    <div className="chart-body">{children}</div>
  </div>
);

/* ─── Insight Category Config ────────────────────────────────── */
const INSIGHT_CFG = {
  hotspot:        { icon: MapPin,       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    label: 'Hotspot'       },
  trend:          { icon: TrendingUp,   color: '#6366f1', bg: 'rgba(99,102,241,0.08)',   label: 'Trend'         },
  performance:    { icon: Target,       color: '#10b981', bg: 'rgba(16,185,129,0.08)',   label: 'Performance'   },
  recommendation: { icon: Lightbulb,   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   label: 'Action Needed' },
  warning:        { icon: AlertTriangle,color: '#f97316', bg: 'rgba(249,115,22,0.08)',   label: 'Warning'       },
  achievement:    { icon: Trophy,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   label: 'Achievement'   },
};

const SEVERITY_DOT = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

/* ─── AI Insight Card ────────────────────────────────────────── */
const InsightCard = ({ insight, idx }) => {
  const isLegacy = typeof insight === 'string';
  const cfg = INSIGHT_CFG[isLegacy ? 'performance' : (insight.category || 'performance')] || INSIGHT_CFG.performance;
  const Icon = cfg.icon;
  const title = isLegacy ? 'Insight' : insight.title;
  const text  = isLegacy ? insight  : insight.insight;
  const sev   = isLegacy ? 'low'    : (insight.severity || 'low');

  return (
    <div className="insight-card-v2" style={{ '--delay': `${idx * 0.07}s`, background: cfg.bg, borderColor: cfg.color + '30' }}>
      <div className="insight-card-header">
        <div className="insight-icon-wrap" style={{ background: cfg.color + '18', color: cfg.color }}>
          <Icon size={15} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="insight-category-label" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className="insight-sev-dot" style={{ background: SEVERITY_DOT[sev] }} title={`${sev} priority`} />
          </div>
          <p className="insight-title-v2">{title}</p>
        </div>
      </div>
      <p className="insight-text-v2">{text}</p>
    </div>
  );
};

/* ─── Mini Stat Row ──────────────────────────────────────────── */
const MiniStat = ({ label, value, color }) => (
  <div className="mini-stat">
    <span className="mini-stat-val" style={{ color }}>{value}</span>
    <span className="mini-stat-label">{label}</span>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   MAIN ANALYTICS PAGE
══════════════════════════════════════════════════════════════ */
const Analytics = () => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        { data: lostItems   },
        { data: foundItems  },
        { data: matchesData },
        { data: claimsData  },
        { data: usersData   },
      ] = await Promise.all([
        supabase.from('lost_items').select('id, category, location, status, created_at, user_id'),
        supabase.from('found_items').select('id, category, location, status, created_at, user_id'),
        supabase.from('matches').select('id, confidence_score, status, created_at'),
        supabase.from('claims').select('id, status, verification_score, created_at, ai_verdict'),
        supabase.from('users').select('id, created_at').order('created_at', { ascending: false }).limit(500),
      ]);

      const lost    = lostItems   || [];
      const found   = foundItems  || [];
      const matches = matchesData || [];
      const claims  = claimsData  || [];
      const users   = usersData   || [];
      const all     = [...lost, ...found];

      /* ── Category breakdown ── */
      const catMap = {};
      lost.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + 1; });
      const categories = Object.entries(catMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      /* ── Found categories ── */
      const foundCatMap = {};
      found.forEach(i => { foundCatMap[i.category] = (foundCatMap[i.category] || 0) + 1; });
      const foundCategories = Object.entries(foundCatMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      /* ── Category comparison (lost vs found) ── */
      const allCats = [...new Set([...Object.keys(catMap), ...Object.keys(foundCatMap)])];
      const catComparison = allCats.map(name => ({
        name,
        lost:  catMap[name] || 0,
        found: foundCatMap[name] || 0,
      })).sort((a, b) => (b.lost + b.found) - (a.lost + a.found)).slice(0, 6);

      /* ── Location breakdown ── */
      const locMap = {};
      lost.forEach(i => {
        const loc = (i.location || 'Unknown').split(' ').slice(0, 3).join(' ');
        locMap[loc] = (locMap[loc] || 0) + 1;
      });
      const locations = Object.entries(locMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      /* ── Monthly trend (last 6 months) ── */
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return {
          month: d.toLocaleString('default', { month: 'short' }),
          year: d.getFullYear(), monthNum: d.getMonth(),
          lost: 0, found: 0, matches: 0, resolved: 0
        };
      });

      lost.forEach(i => {
        const d = new Date(i.created_at);
        const entry = months.find(m => m.monthNum === d.getMonth() && m.year === d.getFullYear());
        if (entry) {
          entry.lost++;
          if (i.status === 'resolved') entry.resolved++;
        }
      });
      found.forEach(i => {
        const d = new Date(i.created_at);
        const entry = months.find(m => m.monthNum === d.getMonth() && m.year === d.getFullYear());
        if (entry) entry.found++;
      });
      matches.forEach(m => {
        const d = new Date(m.created_at);
        const entry = months.find(mo => mo.monthNum === d.getMonth() && mo.year === d.getFullYear());
        if (entry) entry.matches++;
      });

      /* ── Recovery rate per month ── */
      const monthlyRecovery = months.map(m => ({
        month: m.month,
        rate: m.lost > 0 ? Math.round((m.resolved / m.lost) * 100) : 0,
        lost: m.lost, found: m.found, matches: m.matches,
      }));

      /* ── Resolution time analysis ── */
      const resolvedItems = all.filter(i => i.status === 'resolved' && i.created_at);
      const resolutionTimes = resolvedItems.map(i => {
        const created = new Date(i.created_at);
        const now2 = new Date();
        return Math.round((now2 - created) / (1000 * 60 * 60 * 24)); // days
      });
      const avgResolutionDays = resolutionTimes.length
        ? Math.round(resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length)
        : 0;
      const fastResolutions  = resolutionTimes.filter(t => t <= 3).length;
      const slowResolutions  = resolutionTimes.filter(t => t > 7).length;

      /* ── Resolution time buckets ── */
      const resBuckets = [
        { label: '1 day',    count: resolutionTimes.filter(t => t <= 1).length,              color: '#10b981' },
        { label: '2-3 days', count: resolutionTimes.filter(t => t > 1 && t <= 3).length,    color: '#06b6d4' },
        { label: '4-7 days', count: resolutionTimes.filter(t => t > 3 && t <= 7).length,    color: '#f59e0b' },
        { label: '>7 days',  count: resolutionTimes.filter(t => t > 7).length,              color: '#ef4444' },
      ];

      /* ── Core stats ── */
      const totalLost    = lost.length;
      const totalFound   = found.length;
      const resolved     = all.filter(i => i.status === 'resolved').length;
      const active       = all.filter(i => i.status === 'active').length;
      const recoveryRate = totalLost > 0 ? Math.round((resolved / totalLost) * 100) : 0;

      /* ── Match stats ── */
      const activeMatches    = matches.filter(m => m.status === 'pending').length;
      const confirmedMatches = matches.filter(m => m.status === 'confirmed').length;
      const rejectedMatches  = matches.filter(m => m.status === 'rejected').length;
      const avgConfidence    = matches.length
        ? Math.round(matches.reduce((s, m) => s + m.confidence_score, 0) / matches.length) : 0;
      const matchRate = totalLost > 0 ? Math.round((matches.length / totalLost) * 100) : 0;

      /* ── Confidence distribution ── */
      const confBuckets = [
        { range: '<50%',   count: matches.filter(m => m.confidence_score < 50).length,                          color: '#94a3b8' },
        { range: '50–69%', count: matches.filter(m => m.confidence_score >= 50 && m.confidence_score < 70).length, color: '#f59e0b' },
        { range: '70–89%', count: matches.filter(m => m.confidence_score >= 70 && m.confidence_score < 90).length, color: '#06b6d4' },
        { range: '90–100%',count: matches.filter(m => m.confidence_score >= 90).length,                         color: '#10b981' },
      ];

      /* ── AI Verdict distribution ── */
      const verdictMap = { verified: 0, likely: 0, uncertain: 0, suspicious: 0 };
      claims.forEach(c => { if (verdictMap[c.ai_verdict] !== undefined) verdictMap[c.ai_verdict]++; });
      const verdictData = Object.entries(verdictMap).map(([name, value]) => ({ name, value })).filter(v => v.value > 0);

      /* ── Claims stats ── */
      const approvedClaims = claims.filter(c => c.status === 'approved').length;
      const pendingClaims  = claims.filter(c => c.status === 'pending_review').length;
      const avgClaimScore  = claims.filter(c => c.verification_score).length
        ? Math.round(claims.filter(c => c.verification_score).reduce((s, c) => s + c.verification_score, 0) / claims.filter(c => c.verification_score).length)
        : 0;
      const claimRate = totalLost > 0 ? Math.round((claims.length / totalLost) * 100) : 0;

      /* ── User engagement ── */
      const nowMs = Date.now();
      const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);
      const newUsersThisMonth = users.filter(u => new Date(u.created_at) > thirtyDaysAgo).length;
      const activeUsers = [...new Set([...lost, ...found].map(i => i.user_id).filter(Boolean))].length;

      /* ── Status donut ── */
      const statusData = [
        { name: 'Active',   value: active,   color: '#6366f1' },
        { name: 'Resolved', value: resolved, color: '#10b981' },
      ].filter(d => d.value > 0);

      /* ── Match performance over months ── */
      const matchAccuracy = months.map((m, i) => ({
        month: m.month,
        confirmed: matches.filter(mx => {
          const d = new Date(mx.created_at);
          return d.getMonth() === m.monthNum && d.getFullYear() === m.year && mx.status === 'confirmed';
        }).length,
        total: matches.filter(mx => {
          const d = new Date(mx.created_at);
          return d.getMonth() === m.monthNum && d.getFullYear() === m.year;
        }).length,
      })).map(m => ({
        ...m,
        accuracy: m.total > 0 ? Math.round((m.confirmed / m.total) * 100) : 0,
      }));

      const result = {
        totalLost, totalFound, resolved, active, recoveryRate,
        activeMatches, confirmedMatches, rejectedMatches, avgConfidence, matchRate,
        categories, foundCategories, catComparison, locations, months,
        confBuckets, statusData, monthlyRecovery, matchAccuracy,
        avgResolutionDays, fastResolutions, slowResolutions, resBuckets,
        totalMatches: matches.length, approvedClaims, pendingClaims,
        avgClaimScore, claimRate, verdictData,
        newUsersThisMonth, activeUsers,
        topCategories: categories.slice(0, 3),
        topLocations:  locations.slice(0, 3),
        monthlyTrend: months,
      };

      setData(result);
      return result;
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateInsights = async (statsData) => {
    setInsightsLoading(true);
    const result = await runInsightsAgent(statsData);
    setInsights(result.insights || []);
    setInsightsLoading(false);
  };

  useEffect(() => {
    fetchData().then(result => { if (result) generateInsights(result); });
  }, [fetchData]);

  if (loading) return (
    <div className="analytics-loading">
      <div className="analytics-spinner"><BarChart3 size={32} /></div>
      <p className="heading-3">Compiling Advanced Analytics...</p>
      <p className="text-body">Querying all data sources and computing metrics</p>
    </div>
  );

  if (!data) return null;

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: BarChart3  },
    { id: 'activity',    label: 'Activity',    icon: Activity   },
    { id: 'ai',          label: 'AI Metrics',  icon: Brain      },
    { id: 'resolution',  label: 'Resolution',  icon: Clock      },
    { id: 'users',       label: 'Engagement',  icon: Users      },
  ];

  return (
    <div className="analytics-page animate-fade-in">

      {/* ── Header ── */}
      <div className="analytics-header">
        <div className="analytics-header-left">
          <div className="analytics-icon"><BarChart3 size={24} /></div>
          <div>
            <h1 className="heading-2">Advanced Analytics</h1>
            <p className="text-body">Real-time insights · AI-powered analysis · All metrics</p>
          </div>
        </div>
        <button onClick={() => fetchData().then(r => r && generateInsights(r))}
          className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh All
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="kpi-grid">
        <KPICard label="Total Lost"       value={data.totalLost}           icon={Package}    color="#ef4444" />
        <KPICard label="Total Found"      value={data.totalFound}          icon={Package}    color="#10b981" />
        <KPICard label="Recovery Rate"    value={`${data.recoveryRate}%`}  icon={TrendingUp} color="#6366f1" sub="of lost items resolved" />
        <KPICard label="Avg Resolution"   value={`${data.avgResolutionDays}d`} icon={Clock}  color="#f59e0b" sub="average days to resolve" />
        <KPICard label="AI Match Rate"    value={`${data.matchRate}%`}     icon={Brain}      color="#8b5cf6" sub="lost items matched" />
        <KPICard label="Avg AI Confidence" value={`${data.avgConfidence}%`} icon={Target}   color="#06b6d4" />
        <KPICard label="Active Users"     value={data.activeUsers}         icon={Users}      color="#ec4899" />
        <KPICard label="Claims Submitted" value={data.approvedClaims + data.pendingClaims} icon={Shield} color="#14b8a6" />
      </div>

      {/* ── AI Insights Panel ── */}
      <div className="insights-panel glass">
        <div className="insights-header">
          <div className="insights-title">
            <div className="insights-icon"><Brain size={20} /></div>
            <div>
              <h2 className="heading-3">AI Intelligence Report</h2>
              <p className="text-small">Groq LLM analysis · 8 categorized insights</p>
            </div>
          </div>
          <button onClick={() => generateInsights(data)}
            disabled={insightsLoading}
            className="btn-secondary flex items-center gap-2" style={{ fontSize: '0.82rem', padding: '0.5rem 0.875rem' }}>
            {insightsLoading ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
            Regenerate
          </button>
        </div>

        {insightsLoading ? (
          <div className="insights-loading">
            <Loader size={20} className="spin" style={{ color: 'var(--primary)' }} />
            <span>Groq LLM is analyzing all platform data...</span>
          </div>
        ) : (
          <div className="insights-grid-v2">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} idx={i} />
            ))}
          </div>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="analytics-tabs glass">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`analytics-tab-btn ${activeTab === t.id ? 'active' : ''}`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="charts-grid animate-fade-in">

          {/* Monthly Trend */}
          <ChartCard title="Monthly Activity Trend" subtitle="Lost vs Found items over last 6 months" className="span-2">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.months} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMatch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '12px' }} />
                <Area type="monotone" dataKey="lost"    name="Lost"    stroke="#ef4444" fill="url(#gLost)"  strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="found"   name="Found"   stroke="#10b981" fill="url(#gFound)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="matches" name="Matches" stroke="#6366f1" fill="url(#gMatch)" strokeWidth={2}   dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Category Comparison */}
          <ChartCard title="Lost vs Found by Category" subtitle="Side-by-side category breakdown">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.catComparison} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={85} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                <Bar dataKey="lost"  name="Lost"  fill="#ef4444" radius={[0, 4, 4, 0]} />
                <Bar dataKey="found" name="Found" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Status Donut */}
          <ChartCard title="Case Status" subtitle="Active vs Resolved">
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={4} dataKey="value" stroke="none">
                    {data.statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {data.statusData.map((d, i) => (
                  <div key={i} className="donut-legend-item">
                    <span className="donut-dot" style={{ background: d.color }} />
                    <span className="text-small">{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
                <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Total: {data.totalLost + data.totalFound} items
                </div>
              </div>
            </div>
          </ChartCard>

          {/* Locations Bar */}
          <ChartCard title="Loss Hotspot Map" subtitle="Locations with most reported lost items" className="span-2" badge="🔥 Top Zones">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.locations} margin={{ top: 5, right: 20, left: -10, bottom: 35 }}>
                <defs>
                  {GRADIENT.map((color, i) => (
                    <linearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity={1} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={false} tickLine={false} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Items Lost" radius={[6, 6, 0, 0]}>
                  {data.locations.map((_, i) => <Cell key={i} fill={`url(#bg${i % 3})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ── TAB: ACTIVITY ── */}
      {activeTab === 'activity' && (
        <div className="charts-grid animate-fade-in">

          {/* Recovery Rate Trend */}
          <ChartCard title="Recovery Rate Trend" subtitle="Monthly recovery % over last 6 months" className="span-2" badge="📈">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.monthlyRecovery} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '12px' }} />
                <Bar    yAxisId="left"  dataKey="lost"    name="Lost"    fill="#ef444440" radius={[4,4,0,0]} />
                <Bar    yAxisId="left"  dataKey="found"   name="Found"   fill="#10b98140" radius={[4,4,0,0]} />
                <Line   yAxisId="right" dataKey="rate"    name="Recovery %" type="monotone"
                  stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#6366f1' }} activeDot={{ r: 7 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Most Lost Categories */}
          <ChartCard title="Most Lost Categories" subtitle="Top categories by volume">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.categories.slice(0, 6)} layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Lost Items" radius={[0, 6, 6, 0]}>
                  {data.categories.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Match Accuracy trend */}
          <ChartCard title="Match Volume Over Time" subtitle="Total matches detected per month">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.matchAccuracy} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                <Line dataKey="total"     name="Total Matches"     type="monotone" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line dataKey="confirmed" name="Confirmed Matches" type="monotone" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ── TAB: AI METRICS ── */}
      {activeTab === 'ai' && (
        <div className="charts-grid animate-fade-in">

          {/* Confidence Distribution */}
          <ChartCard title="AI Match Confidence Distribution" subtitle="How accurate are the AI matches?" className="span-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.confBuckets} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="range" tick={{ fill: 'var(--text-secondary)', fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Matches" radius={[6, 6, 0, 0]}>
                  {data.confBuckets.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Recovery Gauge */}
          <ChartCard title="Recovery Rate Gauge" subtitle="Percentage of lost items resolved">
            <div className="radial-wrap">
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%"
                  data={[
                    { name: 'Rate', value: data.recoveryRate, fill: '#10b981' },
                    { name: 'Gap',  value: 100 - data.recoveryRate, fill: 'var(--border-color)' }
                  ]} startAngle={180} endAngle={-180}>
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'var(--border-color)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="radial-center">
                <span className="radial-value">{data.recoveryRate}%</span>
                <span className="radial-label">Recovery</span>
              </div>
            </div>
          </ChartCard>

          {/* AI Verdict Donut */}
          <ChartCard title="Claim AI Verdicts" subtitle="Distribution of AI verification verdicts">
            {data.verdictData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                No claims verified yet
              </div>
            ) : (
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.verdictData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={4} dataKey="value" stroke="none">
                      {data.verdictData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-legend">
                  {data.verdictData.map((d, i) => (
                    <div key={i} className="donut-legend-item">
                      <span className="donut-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-small" style={{ textTransform: 'capitalize' }}>{d.name}: <strong>{d.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* AI Performance Summary */}
          <ChartCard title="AI Performance Summary" subtitle="Key AI metrics at a glance">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.5rem' }}>
              <MiniStat label="Avg Confidence" value={`${data.avgConfidence}%`} color="#6366f1" />
              <MiniStat label="Total Matches"  value={data.totalMatches}       color="#10b981" />
              <MiniStat label="Confirmed"       value={data.confirmedMatches}   color="#06b6d4" />
              <MiniStat label="Rejected"        value={data.rejectedMatches}    color="#ef4444" />
              <MiniStat label="Match Rate"      value={`${data.matchRate}%`}    color="#8b5cf6" />
              <MiniStat label="Avg Claim Score" value={`${data.avgClaimScore}/100`} color="#f59e0b" />
            </div>
          </ChartCard>
        </div>
      )}

      {/* ── TAB: RESOLUTION ── */}
      {activeTab === 'resolution' && (
        <div className="charts-grid animate-fade-in">

          {/* Resolution Time Buckets */}
          <ChartCard title="Resolution Time Analysis" subtitle="How quickly are cases resolved?" className="span-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.resBuckets} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Cases Resolved" radius={[6, 6, 0, 0]}>
                  {data.resBuckets.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Resolution Stats */}
          <ChartCard title="Resolution Breakdown">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
              {[
                { label: 'Avg Days to Resolve', value: `${data.avgResolutionDays} days`, color: '#6366f1', icon: Clock },
                { label: 'Fast Resolutions (≤3 days)', value: data.fastResolutions, color: '#10b981', icon: Zap },
                { label: 'Slow Resolutions (>7 days)', value: data.slowResolutions, color: '#ef4444', icon: AlertTriangle },
                { label: 'Total Resolved', value: data.resolved, color: '#8b5cf6', icon: Trophy },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="res-stat-row">
                    <div className="res-stat-icon" style={{ background: s.color + '18', color: s.color }}><Icon size={16} /></div>
                    <span className="res-stat-label">{s.label}</span>
                    <span className="res-stat-val" style={{ color: s.color }}>{s.value}</span>
                  </div>
                );
              })}
            </div>
          </ChartCard>

          {/* Monthly Recovery Trend (line) */}
          <ChartCard title="Monthly Recovery %">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.monthlyRecovery} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Recovery Rate']} />
                <Line dataKey="rate" name="Recovery %" type="monotone"
                  stroke="#10b981" strokeWidth={3}
                  dot={{ r: 5, fill: '#10b981', stroke: 'white', strokeWidth: 2 }}
                  activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ── TAB: ENGAGEMENT ── */}
      {activeTab === 'users' && (
        <div className="charts-grid animate-fade-in">

          {/* Monthly Submissions */}
          <ChartCard title="Monthly Submissions" subtitle="New lost & found reports per month" className="span-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.months} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Bar dataKey="lost"  name="Lost Reports"  fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="found" name="Found Reports" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Engagement KPIs */}
          <ChartCard title="User Engagement Metrics">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
              {[
                { label: 'Active Users', value: data.activeUsers, color: '#6366f1' },
                { label: 'New This Month', value: data.newUsersThisMonth, color: '#10b981' },
                { label: 'Claim Rate', value: `${data.claimRate}%`, color: '#f59e0b' },
                { label: 'Avg Claim Score', value: `${data.avgClaimScore}/100`, color: '#8b5cf6' },
              ].map((s, i) => (
                <div key={i} className="res-stat-row">
                  <span className="res-stat-label">{s.label}</span>
                  <span className="res-stat-val" style={{ color: s.color, fontSize: '1.1rem', fontWeight: 800 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Claims Status Donut */}
          <ChartCard title="Claims Status" subtitle="Approval vs pending vs rejected">
            {(data.approvedClaims + data.pendingClaims) === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No claims yet</div>
            ) : (
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Approved', value: data.approvedClaims,  color: '#10b981' },
                        { name: 'Pending',  value: data.pendingClaims,   color: '#f59e0b' },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={4} dataKey="value" stroke="none">
                      {[{ color: '#10b981' }, { color: '#f59e0b' }].map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-legend">
                  <div className="donut-legend-item"><span className="donut-dot" style={{ background: '#10b981' }} /><span className="text-small">Approved: <strong>{data.approvedClaims}</strong></span></div>
                  <div className="donut-legend-item"><span className="donut-dot" style={{ background: '#f59e0b' }} /><span className="text-small">Pending: <strong>{data.pendingClaims}</strong></span></div>
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── Summary Footer ── */}
      <div className="analytics-footer glass">
        {[
          { val: data.totalMatches,     label: 'AI Matches Generated' },
          { val: data.confirmedMatches, label: 'Matches Confirmed'    },
          { val: data.approvedClaims,   label: 'Claims Approved'      },
          { val: data.pendingClaims,    label: 'Claims Pending'       },
          { val: `${data.avgConfidence}%`, label: 'Avg AI Confidence' },
          { val: `${data.recoveryRate}%`,  label: 'Recovery Rate'     },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <div className="footer-stat">
              <span className="footer-stat-val">{s.val}</span>
              <span className="footer-stat-label">{s.label}</span>
            </div>
            {i < arr.length - 1 && <div className="footer-divider" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Analytics;
