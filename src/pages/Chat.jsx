import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import useRealtime from '../hooks/useRealtime';
import {
  fetchMyConversations,
  fetchMessages,
  sendMessage,
  markMessagesAsRead,
} from '../lib/chatService';
import {
  MessageSquare, Send, Search, ArrowLeft, Package,
  CheckCheck, Check, Loader, User, PackageSearch
} from 'lucide-react';
import './Chat.css';

/* ── Helper: format timestamp ── */
const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const isSameDay = (ts1, ts2) =>
  new Date(ts1).toDateString() === new Date(ts2).toDateString();

/* ── Avatar helper ── */
const Avatar = ({ name, size = 48 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="conv-avatar" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   CHAT WINDOW — Full messaging experience
══════════════════════════════════════════════════════════ */
const ChatWindow = ({ conversation, currentUserId, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const toast = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch messages on conversation open
  useEffect(() => {
    if (!conversation) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const msgs = await fetchMessages(conversation.id);
        if (!cancelled) setMessages(msgs);
        // Mark messages as read
        await markMessagesAsRead(conversation.id, currentUserId);
      } catch (err) {
        console.error('Failed to load messages:', err);
        if (!cancelled) toast.error('Failed to load messages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversation?.id, currentUserId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Real-time subscription for new messages
  useRealtime({
    table: 'messages',
    filter: `conversation_id=eq.${conversation?.id}`,
    enabled: !!conversation?.id,
    onInsert: (newMsg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Mark as read immediately if we're the receiver
      if (newMsg.receiver_id === currentUserId) {
        markMessagesAsRead(conversation.id, currentUserId);
      }
    },
    onUpdate: (updated) => {
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    },
  });

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // Guard: receiver must exist (can happen if same user posted both items)
    const receiverId = conversation.otherUser?.id;
    if (!receiverId || receiverId === currentUserId) {
      toast.error('Cannot send message: the other party is the same account. Use two different user accounts to test chat.');
      return;
    }

    setInput('');
    setSending(true);
    try {
      await sendMessage({
        conversationId: conversation.id,
        senderId: currentUserId,
        receiverId,
        message: text,
      });
    } catch (err) {
      console.error('Send failed:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast.error(`Send failed: ${msg}`);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date for dividers
  const renderMessages = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Loader size={28} className="spin" style={{ color: 'var(--primary)' }} />
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '0.75rem' }}>
          <MessageSquare size={40} style={{ opacity: 0.3 }} />
          <p className="text-small text-center">No messages yet.<br />Say hi to coordinate returning the item!</p>
        </div>
      );
    }

    return messages.map((msg, idx) => {
      const isSent = msg.sender_id === currentUserId;
      const showDateDivider = idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at);

      return (
        <React.Fragment key={msg.id}>
          {showDateDivider && (
            <div className="message-date-divider">
              <span>{formatDate(msg.created_at)}</span>
            </div>
          )}
          <div className={`msg-row ${isSent ? 'sent' : 'received'}`}>
            <div className="msg-bubble">{msg.message}</div>
            <div className="msg-meta">
              <span className="msg-time">{formatTime(msg.created_at)}</span>
              {isSent && (
                <div className="msg-read-tick">
                  {msg.is_read
                    ? <CheckCheck size={14} style={{ color: '#60a5fa' }} />
                    : <Check size={14} style={{ color: 'var(--text-secondary)' }} />
                  }
                </div>
              )}
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  const item = conversation?.lostItem || conversation?.foundItem;

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-window-header">
        <button className="chat-back-btn" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft size={20} />
        </button>

        <Avatar name={conversation.otherUser?.name} size={40} />

        <div className="chat-window-item-info">
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {conversation.otherUser?.name || 'Unknown User'}
          </div>
          {item && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Package size={12} />
              <span>Re: {item.title}</span>
            </div>
          )}
        </div>

        {item?.image_url ? (
          <img src={item.image_url} alt={item.title} className="chat-item-thumbnail" />
        ) : item ? (
          <div className="chat-item-thumbnail-placeholder">
            <PackageSearch size={20} />
          </div>
        ) : null}
      </div>

      {/* Messages */}
      <div className="messages-area">
        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="chat-input-bar">
        <div className="chat-input-wrap">
          <textarea
            ref={inputRef}
            className="chat-text-input"
            rows={1}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            aria-label="Message input"
          />
        </div>
        <button
          className="chat-send-button"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Send message"
        >
          {sending ? <Loader size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN CHAT PAGE
══════════════════════════════════════════════════════════ */
const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeConv, setActiveConv] = useState(null);
  const [mobileShowWindow, setMobileShowWindow] = useState(false);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchMyConversations(user.id);
      setConversations(data);
      // If URL has conversationId, auto-select it
      if (conversationId) {
        const found = data.find(c => c.id === conversationId);
        if (found) { setActiveConv(found); setMobileShowWindow(true); }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      if (!err.message?.includes('does not exist')) {
        toast.error('Failed to load conversations.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, conversationId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Real-time: new conversation created
  useRealtime({
    table: 'conversations',
    enabled: !!user,
    onInsert: () => loadConversations(),
    onUpdate: () => loadConversations(),
  });

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    setMobileShowWindow(true);
    navigate(`/chat/${conv.id}`, { replace: true });
  };

  const handleBack = () => {
    setMobileShowWindow(false);
    setActiveConv(null);
    navigate('/chat', { replace: true });
  };

  const filtered = conversations.filter(c =>
    !search ||
    c.otherUser?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.lostItem?.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.foundItem?.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`chat-page animate-fade-in`}>
      {/* ── Left: Conversation List ── */}
      <div className={`conv-panel ${mobileShowWindow ? 'hidden' : ''}`}>
        <div className="conv-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <MessageSquare size={20} style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Messages</h1>
          </div>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-full)' }}>
            {conversations.length}
          </span>
        </div>

        <div className="conv-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="conv-search-input"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search conversations"
          />
        </div>

        <div className="conv-list">
          {loading ? (
            <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
              <Loader size={24} className="spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <MessageSquare size={36} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p className="text-small">
                {search ? 'No conversations match your search.' : 'No conversations yet. Start one from an item\'s detail page!'}
              </p>
            </div>
          ) : (
            filtered.map(conv => {
              const item = conv.lostItem || conv.foundItem;
              const isActive = activeConv?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  className={`conv-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectConv(conv)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectConv(conv)}
                  aria-current={isActive ? 'true' : 'false'}
                >
                  <Avatar name={conv.otherUser?.name} />
                  <div className="conv-item-content">
                    <div className="conv-item-top">
                      <span className="conv-item-name">{conv.otherUser?.name || 'Unknown'}</span>
                      <span className="conv-item-time">
                        {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                      </span>
                    </div>
                    {item && (
                      <span className="conv-item-tag" style={{ marginBottom: '0.25rem', display: 'inline-block' }}>
                        📦 {item.title}
                      </span>
                    )}
                    <div className="conv-item-preview">
                      {conv.last_message || 'Start a conversation…'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Chat Window ── */}
      {activeConv ? (
        <div className={`${mobileShowWindow ? '' : 'chat-window-desktop'}`}
          style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <ChatWindow
            conversation={activeConv}
            currentUserId={user?.id}
            onBack={handleBack}
          />
        </div>
      ) : (
        <div className="chat-empty-state">
          <div className="chat-empty-icon">
            <MessageSquare size={36} />
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Your Messages
          </h2>
          <p className="text-small" style={{ maxWidth: '280px' }}>
            Select a conversation or start a new one from a Lost or Found item's detail page.
          </p>
        </div>
      )}
    </div>
  );
};

export default Chat;
