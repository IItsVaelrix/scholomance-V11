import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <p>We&apos;re sorry for the inconvenience. Please try refreshing the page.</p>
          {!import.meta.env.PROD && this.state.error && <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.toString()}</pre>}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
