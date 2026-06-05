import React, { useEffect, useState, useCallback } from 'react';
import { User, Settings, LogOut, PackageSearch, Archive, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { SkeletonRow } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUserHistory = useCallback(async () => {
    try {
      setLoading(true);
      const [
        { data: lostData, error: lostError },
        { data: foundData, error: foundError }
      ] = await Promise.all([
        supabase.from('lost_items').select('*').eq('user_id', user.id),
        supabase.from('found_items').select('*').eq('user_id', user.id)
      ]);

      if (lostError || foundError) throw lostError || foundError;

      const combined = [
        ...(lostData || []).map(i => ({ ...i, type: 'lost', date: i.date_lost })),
        ...(foundData || []).map(i => ({ ...i, type: 'found', date: i.date_found }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setHistory(combined);
    } catch (error) {
      toast.error('Failed to load profile history.');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) fetchUserHistory();
  }, [fetchUserHistory, user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      toast.error('Failed to sign out.');
    }
  };

  const activeReports = history.filter(item => item.status === 'active').length;
  const resolvedReports = history.filter(item => item.status === 'resolved').length;

  return (
    <div className="page-container glass animate-fade-in" style={{ borderRadius: 'var(--radius-lg)' }}>
      <h1 className="heading-2 mb-6">User Profile</h1>
      
      <div className="flex gap-6 items-start" style={{ flexWrap: 'wrap' }}>
        {/* Profile Card */}
        <div className="glass flex-col items-center gap-4" style={{ padding: '2.5rem', borderRadius: 'var(--radius-md)', minWidth: '280px', flex: 1 }}>
          <div style={{ width: '100px', height: '100px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }} aria-hidden="true">
            <User size={48} />
          </div>
          <div className="text-center mb-4">
            <h3 className="heading-3">{profile?.name || user?.email}</h3>
            <p className="text-small">{profile?.role === 'admin' ? 'Administrator' : 'Student'}</p>
          </div>
          <button className="btn-secondary w-full flex justify-center items-center gap-2 mb-2"><Settings size={18} /> Edit Profile</button>
          <button onClick={handleSignOut} className="btn-secondary w-full flex justify-center items-center gap-2" style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}><LogOut size={18} /> Sign Out</button>
        </div>
        
        {/* History Panel */}
        <div className="flex-[2] glass" style={{ padding: '2rem', borderRadius: 'var(--radius-md)', minWidth: '320px' }}>
          <h3 className="heading-3 mb-4">My History</h3>
          
          {loading ? (
             <div className="flex-col gap-3">
               {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
             </div>
          ) : (
            <>
              <div className="flex gap-4 mb-6">
                <div className="glass px-4 py-2" style={{ borderRadius: 'var(--radius-md)' }}>
                  <span className="text-small text-secondary">Active</span>
                  <p className="heading-3 text-primary-color">{activeReports}</p>
                </div>
                <div className="glass px-4 py-2" style={{ borderRadius: 'var(--radius-md)' }}>
                  <span className="text-small text-secondary">Resolved</span>
                  <p className="heading-3" style={{ color: 'var(--success)' }}>{resolvedReports}</p>
                </div>
              </div>

              <div className="flex-col gap-3">
                 {history.length === 0 ? (
                   <EmptyState icon={Clock} title="No reports found" description="You haven't reported any lost or found items yet." />
                 ) : (
                   history.map(item => (
                     <Link to={`/item/${item.type}/${item.id}`} key={`${item.type}-${item.id}`} className="glass flex justify-between items-center" style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', borderLeft: `4px solid ${item.type === 'lost' ? 'var(--danger)' : 'var(--success)'}`, textDecoration: 'none', color: 'inherit', display: 'flex', transition: 'var(--transition)' }}>
                        <div>
                          <h4 className="font-medium mb-1">{item.title}</h4>
                          <p className="text-small flex items-center gap-2">
                            {item.type === 'lost' ? <PackageSearch size={12} /> : <Archive size={12} />}
                            <span style={{ textTransform: 'capitalize' }}>{item.type}</span> • {item.date}
                          </p>
                        </div>
                        <span className={`status-pill ${item.status}`} style={{ fontSize: '0.75rem' }}>{item.status}</span>
                     </Link>
                   ))
                 )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
