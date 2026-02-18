import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', color: '#ff4d4f', backgroundColor: '#fff', height: '100vh', overflow: 'auto', fontFamily: 'monospace' }}>
                    <h1 style={{ marginBottom: '20px' }}>Something went wrong.</h1>
                    <div style={{ backgroundColor: '#fff1f0', padding: '20px', borderRadius: '8px', border: '1px solid #ffccc7' }}>
                        <h3 style={{ marginTop: 0 }}>{this.state.error && this.state.error.toString()}</h3>
                        <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>View Stack Trace</summary>
                            <p style={{ marginTop: '10px', fontSize: '12px', lineHeight: '1.5' }}>
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </p>
                        </details>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '20px', padding: '8px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
