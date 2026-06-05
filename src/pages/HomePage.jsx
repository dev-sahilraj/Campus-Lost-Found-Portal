import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="hero-section glass">
        <div className="hero-content">
          <div className="badge animate-fade-in">
            <Sparkles size={16} />
            <span>AI-Powered Matching</span>
          </div>
          <h1 className="heading-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            AI-Powered Campus Lost & Found
          </h1>
          <p className="subtitle animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Find lost belongings faster using intelligent matching and autonomous AI agents.
          </p>
          <div className="hero-actions animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/report-lost')}>
              <ShieldAlert size={20} />
              Report Lost Item
            </button>
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/search')}>
              <Search size={20} />
              Search Found Items
            </button>
          </div>
        </div>
        
        <div className="hero-visual animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="floating-card c1 glass">
            <div className="mock-img img1"></div>
            <div className="card-info">
              <span className="title">MacBook Pro</span>
              <span className="status lost">Lost</span>
            </div>
          </div>
          <div className="floating-card c2 glass">
            <div className="mock-img img2"></div>
            <div className="card-info">
              <span className="title">Apple Laptop</span>
              <span className="status found">Found</span>
            </div>
          </div>
          <div className="match-line glass">
            <Sparkles className="match-icon" size={24} />
            <span className="match-text">95% Match Found!</span>
          </div>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card glass">
          <div className="icon-wrapper"><Sparkles size={24} /></div>
          <h3 className="heading-3">Smart Matching</h3>
          <p className="text-body">Our AI agents automatically scan reported items to find perfect matches, saving you hours of manual searching.</p>
        </div>
        <div className="feature-card glass">
          <div className="icon-wrapper"><ShieldAlert size={24} /></div>
          <h3 className="heading-3">Secure Verification</h3>
          <p className="text-body">Claim items securely through our trusted campus verification system.</p>
        </div>
        <div className="feature-card glass">
          <div className="icon-wrapper"><Search size={24} /></div>
          <h3 className="heading-3">Real-time Alerts</h3>
          <p className="text-body">Get instant notifications the moment a potential match for your lost item is turned in.</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
