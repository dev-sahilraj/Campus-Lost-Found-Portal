import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import useRealtime from '../../hooks/useRealtime';
import { useToast } from '../ui/Toast';
import { Send, User, Loader } from 'lucide-react';
import './MatchChat.css';

const MatchChat = ({ matchId, currentUserId, otherUserId, otherUserName, contactRole }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const toast = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
  }, [matchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      // Suppress toast if table doesn't exist yet
      if (!err.message?.includes('does not exist')) {
        toast.error('Failed to load chat history.');
      }
    } finally {
      setLoading(false);
    }
  };

  useRealtime({
    table: 'messages',
    filter: `match_id=eq.${matchId}`,
    onInsert: (newMsg) => {
      // Only append if it's not already in the list (to prevent local duplication)
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    }
  });

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMsg = {
        match_id: matchId,
        sender_id: currentUserId,
        receiver_id: otherUserId,
        content: content,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert([newMsg])
        .select()
        .single();

      if (error) throw error;
      
      // Send a notification to the other user so they know they got a message
      await supabase.from('notifications').insert([{
        user_id: otherUserId,
        message: `New chat message from ${contactRole}: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        is_read: false
      }]);

    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message. Is the messages table created?');
      setInputText(content); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="match-chat-container">
      <div className="chat-header">
        <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
          <User size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="chat-header-info">
          <strong className="text-body font-medium">{otherUserName || contactRole}</strong>
          <span className="text-small text-secondary">Real-time Chat</span>
        </div>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Loader size={24} className="spin text-secondary" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <p className="text-small mb-2">No messages yet.</p>
            <p className="text-small text-center">Start the conversation to coordinate returning the item!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isSent = msg.sender_id === currentUserId;
            return (
              <div key={msg.id || idx} className={`chat-bubble-wrap ${isSent ? 'sent' : 'received'}`}>
                <div className="chat-bubble">
                  {msg.content}
                </div>
                <span className="chat-timestamp">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          className="input-field"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={sending || loading}
        />
        <button type="submit" className="chat-send-btn" disabled={!inputText.trim() || sending || loading} aria-label="Send message">
          {sending ? <Loader size={16} className="spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
};

export default MatchChat;
