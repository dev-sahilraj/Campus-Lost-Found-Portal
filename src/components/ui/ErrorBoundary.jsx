import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/** React Error Boundary — catches runtime errors and shows a fallback UI */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="eb-icon"><AlertTriangle size={40} /></div>
          <h2 className="heading-3">Something went wrong</h2>
          <p className="text-body">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="eb-actions">
            <button onClick={this.handleReset} className="btn-primary flex items-center gap-2">
              <RefreshCw size={16} /> Reload Page
            </button>
            <a href="/" className="btn-secondary flex items-center gap-2" style={{ textDecoration: 'none' }}>
              <Home size={16} /> Go Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
