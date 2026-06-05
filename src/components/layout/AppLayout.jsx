import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import useRealtime from '../../hooks/useRealtime';
import { 
  Home, 
  LayoutDashboard, 
  Search, 
  PlusCircle, 
  Inbox, 
  Bell, 
  User, 
  Settings,
  Moon,
  Sun,
  Menu,
  X,
  BarChart3,
  MessageSquare,
  Brain,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AIAssistant from './AIAssistant';
import './AppLayout.css';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/search', label: 'Search & Filter', icon: Search },
  { path: '/report-lost', label: 'Report Lost', icon: PlusCircle },
  { path: '/report-found', label: 'Report Found', icon: PlusCircle },
  { path: '/matches', label: 'Match Center', icon: Inbox },
  { path: '/chat', label: 'Messages', icon: MessageSquare },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/ai-activity', label: 'AI Pipeline', icon: Brain },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/admin', label: 'Admin', icon: Settings },
];

const AppLayout = ({ children, theme, toggleTheme }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => 
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      fetchUnreadMsgCount();
    } else {
      setUnreadCount(0);
      setUnreadMsgCount(0);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Error fetching notifications count', err);
    }
  };

  const fetchUnreadMsgCount = async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      setUnreadMsgCount(count || 0);
    } catch (err) {
      // messages table may not be created yet, silently fail
    }
  };

  useRealtime({
    table: 'notifications',
    filter: `user_id=eq.${user?.id}`,
    enabled: !!user,
    onInsert: (newNotif) => {
      if (!newNotif.is_read) setUnreadCount(prev => prev + 1);
    },
    onUpdate: (updated) => { fetchUnreadCount(); },
    onDelete: () => { fetchUnreadCount(); }
  });

  useRealtime({
    table: 'messages',
    filter: `receiver_id=eq.${user?.id}`,
    enabled: !!user,
    onInsert: (newMsg) => {
      if (!newMsg.is_read) setUnreadMsgCount(prev => prev + 1);
    },
    onUpdate: () => { fetchUnreadMsgCount(); },
  });

  return (
    <div className="app-layout">
      {/* Skip to main content for accessibility */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Desktop Sidebar */}
      <aside className={`sidebar glass ${isMobileMenuOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`} aria-label="Main Navigation">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon"></div>
            {!isSidebarCollapsed && <span className="logo-text">Campus L&F</span>}
          </div>
          <button className="desktop-collapse-btn btn-icon" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button className="mobile-close btn-icon" aria-label="Close mobile menu" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isNotif = item.path === '/notifications';
            const isChat = item.path === '/chat';
            return (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                <div style={{ position: 'relative', display: 'flex' }}>
                  <Icon size={20} />
                  {isNotif && unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                  {isChat && unreadMsgCount > 0 && (
                    <span className="notif-badge">{unreadMsgCount > 99 ? '99+' : unreadMsgCount}</span>
                  )}
                </div>
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title="Toggle Theme">
            {theme === 'light' ? (
              <><Moon size={20} /> {!isSidebarCollapsed && <span>Dark Mode</span>}</>
            ) : (
              <><Sun size={20} /> {!isSidebarCollapsed && <span>Light Mode</span>}</>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" id="main-content" tabIndex="-1">
        {/* Mobile Header */}
        <header className="mobile-header glass">
          <div className="logo-container">
            <div className="logo-icon"></div>
            <span className="logo-text">Campus L&F</span>
          </div>
          <div className="mobile-actions">
            <button className="btn-icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button className="btn-icon" aria-label="Open mobile menu" onClick={() => setIsMobileMenuOpen(true)}>
              <div style={{ position: 'relative' }}>
                <Menu size={24} />
                {unreadCount > 0 && <span className="notif-badge" style={{ right: '-4px', top: '-4px', minWidth: '12px', height: '12px', padding: 0 }} />}
              </div>
            </button>
          </div>
        </header>

        <div className="page-container animate-fade-in">
          {children}
        </div>
      </main>

      <AIAssistant />

      {/* Mobile Bottom Navigation - For essential paths */}
      <nav className="bottom-nav glass" aria-label="Mobile Bottom Navigation">
        <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/report-lost" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <PlusCircle size={20} />
          <span>Report</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <div style={{ position: 'relative', display: 'flex' }}>
            <MessageSquare size={20} />
            {unreadMsgCount > 0 && <span className="notif-badge">{unreadMsgCount > 99 ? '99+' : unreadMsgCount}</span>}
          </div>
          <span>Chat</span>
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <div style={{ position: 'relative', display: 'flex' }}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </div>
          <span>Alerts</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <User size={20} />
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default AppLayout;
