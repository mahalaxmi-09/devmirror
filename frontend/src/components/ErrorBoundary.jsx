import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('DevMirror render error:', error?.message || error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050705] text-[#F4F7F2] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full border border-[#1C261D] rounded-xl bg-[#090D09] p-8 text-center space-y-4">
            <h1 className="text-lg font-bold">DevMirror encountered an unexpected error.</h1>
            <p className="text-sm text-[#9AA49B]">
              Something went wrong while loading this page. You can try reloading the application.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="bg-[#7CFF4F] text-[#050705] hover:bg-[#9DFF70] px-5 py-2.5 rounded font-bold text-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
