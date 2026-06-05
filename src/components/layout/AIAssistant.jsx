import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { analyzeUserMessage } from '../../agents/assistantAgent';
import './AIAssistant.css';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your AI campus assistant. Did you lose or find something? How can I help?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await analyzeUserMessage(userMsg);
      
      const newMsg = {
        role: 'assistant',
        content: response.reply,
        action: response.suggested_action,
        prefill: response.prefill_data
      };
      
      setMessages(prev => [...prev, newMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I am having trouble connecting right now.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (action, prefill) => {
    if (prefill && Object.keys(prefill).length > 0) {
      // Store prefill data in sessionStorage to be picked up by forms
      sessionStorage.setItem('ai_prefill', JSON.stringify(prefill));
    }
    navigate(action.link);
    setIsOpen(false);
  };

  return (
    <div className="ai-assistant-widget">
      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <div className="ai-icon-wrap" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem', borderRadius: '50%' }}>
              <Bot size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="ai-chat-title">AI Assistant</h3>
              <p className="ai-chat-sub">Powered by Groq</p>
            </div>
            <button className="btn-icon" style={{ color: 'white' }} onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                <p>{msg.content}</p>
                {msg.action && (
                  <button 
                    onClick={() => handleActionClick(msg.action, msg.prefill)}
                    className="ai-action-btn"
                  >
                    {msg.action.label}
                  </button>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="ai-typing">
                <span className="ai-dot"></span>
                <span className="ai-dot"></span>
                <span className="ai-dot"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-input-area">
            <form onSubmit={handleSend} className="ai-input-form">
              <input
                type="text"
                className="ai-input"
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTyping}
              />
              <button type="submit" className="ai-send-btn" disabled={!input.trim() || isTyping}>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      <button 
        className={`ai-assistant-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>
    </div>
  );
};

export default AIAssistant;
