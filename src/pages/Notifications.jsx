import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import useRealtime from '../hooks/useRealtime';
import { useToast } from '../components/ui/Toast';
import { SkeletonRow } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Bell, CheckCheck, Trash2, Brain, Info, AlertTriangle } from 'lucide-react';

const NotifIcon = ({ message }) => {
  if (message?.includes('match') || message?.includes('AI')) return <Brain size={16} style={{ color: 'var(--primary)' }} />;
  if (message?.includes('claim') || message?.includes('Claim')) return <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />;
  return <Info size={16} style={{ color: 'var(--success)' }} />;
};

const Notifications = () => {
  const { user } = useAuth();
  const toast     = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Real-time: prepend new notifications instantly
  useRealtime({
    table: 'notifications',
    filter: `user_id=eq.${user?.id}`,
    enabled: !!user,
    onInsert: (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      toast.info(newNotif.message.slice(0, 60) + (newNotif.message.length > 60 ? '...' : ''));
    },
    onUpdate: (updated) => {
      setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
    },
  });

  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotif = async (id) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notif-page animate-fade-in">
      <div className="notif-header">
        <div className="notif-header-left">
          <div className="notif-icon"><Bell size={22} /></div>
          <div>
            <h1 className="heading-2">Notifications</h1>
            <p className="text-small">{unread > 0 ? `${unread} unread` : 'All caught up!'}</p>
          </div>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={markingAll}
            className="btn-secondary flex items-center gap-2" aria-label="Mark all notifications as read">
            <CheckCheck size={16} /> Mark All Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="notif-list">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)' }}>
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="When AI finds matches, someone contacts you, or claims are reviewed — you'll see them here."
          />
        </div>
      ) : (
        <div className="notif-list" role="list">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item glass ${!n.is_read ? 'unread' : ''}`}
              role="listitem"
              aria-label={n.is_read ? 'Read notification' : 'Unread notification'}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className="notif-item-icon-col" aria-hidden="true">
                <NotifIcon message={n.message} />
                {!n.is_read && <span className="unread-dot" aria-hidden="true" />}
              </div>
              <div className="notif-item-body">
                <p className="notif-message">{n.message}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                  <p className="notif-time" style={{ margin: 0 }}>{new Date(n.created_at).toLocaleString()}</p>
                  {n.action_link && (
                    <Link to={n.action_link} className="notif-action-btn" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>
                      {n.action_label || 'View Details'}
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                className="notif-delete"
                aria-label="Delete notification"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
