import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Eagerly load auth + home pages (fast initial paint)
import HomePage   from './pages/HomePage';
import Login      from './pages/Login';
import Signup     from './pages/Signup';

// Lazy-load all protected pages (code-splitting)
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const ReportLostItem   = lazy(() => import('./pages/ReportLostItem'));
const ReportFoundItem  = lazy(() => import('./pages/ReportFoundItem'));
const SearchFilter     = lazy(() => import('./pages/SearchFilter'));
const MatchCenter      = lazy(() => import('./pages/MatchCenter'));
const Notifications    = lazy(() => import('./pages/Notifications'));
const Profile          = lazy(() => import('./pages/Profile'));
const AdminDashboard   = lazy(() => import('./pages/AdminDashboard'));
const ItemDetail       = lazy(() => import('./pages/ItemDetail'));
const ClaimItem        = lazy(() => import('./pages/ClaimItem'));
const Analytics        = lazy(() => import('./pages/Analytics'));
const Chat             = lazy(() => import('./pages/Chat'));
const AIActivity       = lazy(() => import('./pages/AIActivity'));

// Page loading fallback
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '50%',
      border: '3px solid var(--border-color)',
      borderTopColor: 'var(--primary)',
      animation: 'spin 0.8s linear infinite'
    }} />
  </div>
);

function App() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <AppLayout theme={theme} toggleTheme={toggleTheme}>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public */}
                    <Route path="/"       element={<HomePage />} />
                    <Route path="/login"  element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Protected — lazy loaded */}
                    <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/report-lost"  element={<ProtectedRoute><ReportLostItem /></ProtectedRoute>} />
                    <Route path="/report-found" element={<ProtectedRoute><ReportFoundItem /></ProtectedRoute>} />
                    <Route path="/search"       element={<ProtectedRoute><SearchFilter /></ProtectedRoute>} />
                    <Route path="/item/:type/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
                    <Route path="/claim/:type/:id" element={<ProtectedRoute><ClaimItem /></ProtectedRoute>} />
                    <Route path="/analytics"    element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                    <Route path="/matches"      element={<ProtectedRoute><MatchCenter /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                    <Route path="/profile"      element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/admin"        element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/chat"         element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                    <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                    <Route path="/ai-activity"  element={<ProtectedRoute><AIActivity /></ProtectedRoute>} />

                    {/* 404 fallback */}
                    <Route path="*" element={
                      <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>404 — Page not found</h2>
                        <a href="/" style={{ color: 'var(--primary)', marginTop: '1rem', display: 'inline-block' }}>Go Home</a>
                      </div>
                    } />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </AppLayout>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
