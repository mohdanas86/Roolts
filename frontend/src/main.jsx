import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

const App = lazy(() => import('./App.jsx'));

const LoadingSpinner = () => (
  <div className="premium-loading-container">
    <div className="loading-bg-elements">
      <div className="loading-glow-orb orb-1"></div>
      <div className="loading-glow-orb orb-2"></div>
    </div>

    <div className="loading-content">
      <div className="loading-logo-wrapper">
        <div className="loading-logo-glow"></div>
        <div className="loading-logo-icon">R</div>
      </div>

      <div className="loading-brand">
        <h1 className="loading-title">Roolts</h1>
        <p className="loading-subtitle">Intelligent Development Environment</p>
      </div>

      <div className="loading-progress-container">
        <div className="loading-progress-bar"></div>
      </div>

      <div className="loading-status-text">Initializing AI workspace...</div>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
