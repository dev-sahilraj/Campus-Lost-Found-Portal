import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { SkeletonGrid, SkeletonRow, SkeletonHeader } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PackageSearch, Archive, Activity, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const toast    = useToast();
  const [metrics, setMetrics] = useState({ totalLost: 0, totalFound: 0, activeMatches: 0, resolvedCases: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      // Run queries in parallel
      const [
        { count: lostCount },
        { count: foundCount },
        { count: matchesCount },
        { count: resolvedLostCount },
        { count: resolvedFoundCount },
        { data: lostData },
        { data: foundData }
      ] = await Promise.all([
        supabase.from('lost_items').select('*', { count: 'exact', head: true }),
        supabase.from('found_items').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('lost_items').select('id, title, location, date_lost, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('found_items').select('id, title, location, date_found, created_at').order('created_at', { ascending: false }).limit(3)
      ]);

      setMetrics({
        totalLost: lostCount || 0,
        totalFound: foundCount || 0,
        activeMatches: matchesCount || 0,
        resolvedCases: (resolvedLostCount || 0) + (resolvedFoundCount || 0)
      });

      const combined = [
        ...(lostData || []).map(item => ({ ...item, type: 'lost', date: item.date_lost })),
        ...(foundData || []).map(item => ({ ...item, type: 'found', date: item.date_found }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

      setRecentActivity(combined);
    } catch (error) {
      toast.error('Failed to load dashboard data. Please try again.');
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="dashboard-header">
        {loading ? <SkeletonHeader /> : (
          <>
            <h1 className="heading-2">Dashboard Overview</h1>
            <p className="text-body">Welcome back, {user?.user_metadata?.name || 'User'}! Here's what's happening across campus.</p>
          </>
        )}
      </div>

      <div className="metrics-grid">
        {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: '110px' }}><SkeletonGrid count={1} /></div>) : (
          <>
            <MetricCard title="Total Lost Items" value={metrics.totalLost} icon={<PackageSearch size={24} />} color="var(--danger)" />
            <MetricCard title="Total Found Items" value={metrics.totalFound} icon={<Archive size={24} />} color="var(--success)" />
            <MetricCard title="Active Matches" value={metrics.activeMatches} icon={<Activity size={24} />} color="var(--primary)" />
            <MetricCard title="Resolved Cases" value={metrics.resolvedCases} icon={<CheckCircle size={24} />} color="var(--accent)" />
          </>
        )}
      </div>

      <div className="dashboard-content">
        <div className="recent-activity glass">
          <div className="section-header">
            <h3 className="heading-3">Recent Reports</h3>
            <Link to="/search" className="btn-secondary" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>View All</Link>
          </div>
          <div className="activity-list">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            ) : recentActivity.length === 0 ? (
              <EmptyState icon={Clock} title="No recent activity" description="No items have been reported yet." />
            ) : (
              recentActivity.map((item) => (
                <Link to={`/item/${item.type}/${item.id}`} key={`${item.type}-${item.id}`} className="activity-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className={`activity-icon ${item.type}`} aria-hidden="true">
                    {item.type === 'lost' ? <PackageSearch size={16} /> : <Archive size={16} />}
                  </div>
                  <div className="activity-details">
                    <span className="activity-title">{item.title}</span>
                    <span className="activity-meta">
                      <Clock size={12} /> {item.date} • {item.location}
                    </span>
                  </div>
                  <div className={`activity-badge ${item.type}`}>
                    {item.type.toUpperCase()}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
        
        <div className="quick-actions glass">
          <h3 className="heading-3 mb-4">Quick Actions</h3>
          <div className="actions-list">
             <Link to="/report-lost" className="action-btn" style={{ textDecoration: 'none', display: 'block' }}>Report Lost Item</Link>
             <Link to="/report-found" className="action-btn" style={{ textDecoration: 'none', display: 'block' }}>Report Found Item</Link>
             <Link to="/search" className="action-btn" style={{ textDecoration: 'none', display: 'block' }}>Search Database</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }) => (
  <div className="metric-card glass">
    <div className="metric-icon" style={{ color: color, backgroundColor: `${color}1A` }} aria-hidden="true">
      {icon}
    </div>
    <div className="metric-info">
      <span className="metric-value">{value}</span>
      <span className="metric-title">{title}</span>
    </div>
  </div>
);

export default Dashboard;
