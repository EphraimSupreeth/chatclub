import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ChatClub application error', {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="loading-page">
          <section className="error-card" role="alert">
            <span className="brand-mark">C</span>
            <h1>ChatClub needs to reload</h1>
            <p>
              Something unexpected happened. Your message was not assumed to be sent.
            </p>
            <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
              Reload ChatClub
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
