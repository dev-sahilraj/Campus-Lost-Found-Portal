import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { SkeletonGrid, SkeletonHeader } from '../components/ui/Skeleton';
import { getOrCreateConversation } from '../lib/chatService';
import { Mail, CheckCircle, ArrowLeft, Send, ShieldCheck, Tag, MapPin, Palette, Calendar, PackageX, MessageSquare, Loader } from 'lucide-react';

const ItemDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [poster, setPoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [hasClaim, setHasClaim] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const fetchItemDetails = useCallback(async () => {
    try {
      setLoading(true);
      const tableName = type === 'lost' ? 'lost_items' : 'found_items';

      const { data: itemData, error: itemError } = await supabase
        .from(tableName).select('*').eq('id', id).single();
      if (itemError) throw itemError;
      setItem(itemData);

      const { data: userData } = await supabase
        .from('users').select('name, email').eq('id', itemData.user_id).single();
      if (userData) setPoster(userData);

      if (user) {
        const { data: claimData } = await supabase
          .from('claims').select('id').eq('item_id', id).eq('claimant_id', user.id).limit(1).maybeSingle();
        setHasClaim(!!claimData);
      }
    } catch (error) {
      toast.error('Item not found or access denied.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, type, user, navigate, toast]);

  useEffect(() => { fetchItemDetails(); }, [fetchItemDetails]);

  const handleMarkResolved = async () => {
    try {
      const tableName = type === 'lost' ? 'lost_items' : 'found_items';
      const { error } = await supabase.from(tableName).update({ status: 'resolved' }).eq('id', id);
      if (error) throw error;
      setItem(prev => ({ ...prev, status: 'resolved' }));
      toast.success('Item marked as resolved.');
    } catch (error) {
      toast.error('Failed to update status.');
    }
  };

  const handleInAppContact = async () => {
    setSendingNotif(true);
    try {
      const senderName = profile?.name || user?.email;
      const message = `${senderName} is interested in your ${type} item: ${item.title}.`;
      const { error } = await supabase.from('notifications').insert([{
        user_id: item.user_id, message, is_read: false
      }]);
      if (error) throw error;
      toast.success('Notification sent to poster!');
    } catch (error) {
      toast.error('Failed to send notification.');
    } finally {
      setSendingNotif(false);
    }
  };

  const handleStartChat = async () => {
    if (!item?.user_id || !user?.id) return;
    setStartingChat(true);
    try {
      // Determine which item is lost and which is found
      const lostItemId = type === 'lost' ? item.id : null;
      const foundItemId = type === 'found' ? item.id : null;

      const conv = await getOrCreateConversation({
        lostItemId,
        foundItemId,
        participant1: user.id,
        participant2: item.user_id,
      });

      navigate(`/chat/${conv.id}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
      toast.error('Could not start conversation. Please check the database setup.');
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) return (
    <div className="page-container glass animate-fade-in" style={{ borderRadius: 'var(--radius-lg)' }}>
      <SkeletonHeader />
      <div style={{ marginTop: '2rem' }}><SkeletonGrid count={2} /></div>
    </div>
  );

  if (!item) return null;

  const isOwner = user?.id === item.user_id;

  return (
    <div className="page-container glass animate-fade-in" style={{ borderRadius: 'var(--radius-lg)' }}>
      <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2 mb-6" style={{ padding: '0.5rem 1rem' }} aria-label="Go back">
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2.5rem' }}>
        {/* Image Panel */}
        <div className="item-detail-image-panel glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: '400px', display: 'flex', flexDirection: 'column' }}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', opacity: 0.7 }}>
              <PackageX size={64} style={{ marginBottom: '1rem' }} />
              <span>No image provided</span>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="flex-col gap-6">
          <div>
            <div className="flex justify-between items-start mb-3">
              <h1 className="heading-2">{item.title}</h1>
              <span className={`status-pill ${item.status}`} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
                {item.status}
              </span>
            </div>
            <div className="flex gap-2 mb-4">
              <span className={`type-badge ${type}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>{type} ITEM</span>
              <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Tag size={12}/>{item.category}</span>
            </div>
          </div>

          {/* Details Box */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h3 className="heading-3 mb-4">Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <p className="text-small font-medium text-secondary flex items-center gap-1 mb-1"><Palette size={14}/> Color</p>
                <p className="text-body font-medium">{item.color || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-small font-medium text-secondary flex items-center gap-1 mb-1"><Calendar size={14}/> Date {type === 'lost' ? 'Lost' : 'Found'}</p>
                <p className="text-body font-medium">{type === 'lost' ? item.date_lost : item.date_found}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="text-small font-medium text-secondary flex items-center gap-1 mb-1"><MapPin size={14}/> Location</p>
                <p className="text-body font-medium">{item.location}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="text-small font-medium text-secondary mb-1">Description</p>
                <p className="text-body" style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>{item.description}</p>
              </div>
            </div>
          </div>

          {/* Actions Box */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h3 className="heading-3 mb-4">Poster Info</h3>
            <p className="text-body mb-4"><strong>Name:</strong> {poster?.name || 'Anonymous Student'}</p>

            {!isOwner && item.status === 'active' && (
              <div className="flex-col gap-3">
                {/* Primary Chat Button */}
                <button
                  onClick={handleStartChat}
                  disabled={startingChat}
                  className="btn-primary flex items-center justify-center gap-2"
                  style={{ width: '100%' }}
                >
                  {startingChat ? <Loader size={18} className="spin" /> : <MessageSquare size={18} />}
                  {startingChat ? 'Opening Chat...' : `Chat with ${type === 'lost' ? 'Finder' : 'Owner'}`}
                </button>

                <a href={`mailto:${poster?.email || ''}?subject=Regarding your ${type} item: ${item.title}`}
                  className="btn-secondary flex items-center justify-center gap-2" style={{ textDecoration: 'none' }}>
                  <Mail size={18} /> Quick Contact (Email)
                </a>
                <button onClick={handleInAppContact} disabled={sendingNotif} className="btn-secondary flex items-center justify-center gap-2">
                  <Send size={18} /> {sendingNotif ? 'Sending...' : 'In-App Notification'}
                </button>

                {/* Claim Flow */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  {hasClaim ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.9rem', backgroundColor: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <CheckCircle size={18} /> You have already submitted a claim for this item. Check your notifications.
                    </div>
                  ) : (
                    <Link to={`/claim/${type}/${id}`} className="btn-secondary flex items-center justify-center gap-2 w-full" style={{ textDecoration: 'none' }}>
                      <ShieldCheck size={18} /> Claim This Item (AI Verification)
                    </Link>
                  )}
                </div>
              </div>
            )}

            {isOwner && item.status === 'active' && (
              <button onClick={handleMarkResolved} className="btn-primary flex items-center justify-center gap-2 w-full" style={{ background: 'var(--success)' }}>
                <CheckCircle size={18} /> Mark as Resolved
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
