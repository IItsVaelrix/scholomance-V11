import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <span className="error-boundary-glyph" aria-hidden="true">&#x2736;</span>
          <h1 className="error-boundary-title">The rite was interrupted.</h1>
          <p className="error-boundary-message">A disturbance in the weave has disrupted this surface. Please refresh to restore the binding.</p>
          {!import.meta.env.PROD && this.state.error && (
            <pre className="error-boundary-details">{this.state.error.toString()}</pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
