import { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 1. Global Window Level Error Catchers (Pre-render & general JS load issues)
window.addEventListener('error', (event) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 24px; background: #fff5f5; color: #c53030; font-family: monospace; border-radius: 12px; border: 1px solid #feb2b2; margin: 24px; max-width: 800px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Uncaught Load Error (সাদা স্ক্রিনের কারণ):</h2>
        <p style="font-size: 13px; margin: 0 0 16px 0; color: #742a2a;">মডিউল লোড অথবা ব্রাউজার স্ক্রিপ্ট রান করার সময় নিচের সমস্যাটি হয়েছে:</p>
        <pre style="white-space: pre-wrap; background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #fecaca; font-size: 12.5px; line-height: 1.5; color: #1a1a1a; overflow-x: auto;">${event.message}\n\nFile: ${event.filename}\nLine: ${event.lineno}:${event.colno}\n\nStack: ${event.error?.stack || 'No stack trace available'}</pre>
        <button onclick="window.location.reload()" style="margin-top: 16px; padding: 10px 18px; background: #c53030; color: white; border: none; borderRadius: 6px; cursor: pointer; font-weight: bold;">রিলোড করুন (Reload Page)</button>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const root = document.getElementById('root');
  if (root) {
    const reasonMsg = event.reason instanceof Error ? event.reason.message : String(event.reason);
    const reasonStack = event.reason instanceof Error ? event.reason.stack : '';
    root.innerHTML = `
      <div style="padding: 24px; background: #fff5f5; color: #c53030; font-family: monospace; border-radius: 12px; border: 1px solid #feb2b2; margin: 24px; max-width: 800px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Unhandled Promise Rejection (সাদা স্ক্রিনের কারণ):</h2>
        <p style="font-size: 13px; margin: 0 0 16px 0; color: #742a2a;">ডাটাবেজ বা ব্যাকএন্ড রিকোয়েস্টের উত্তর আসার সময় নিচের সমস্যাটি হয়েছে:</p>
        <pre style="white-space: pre-wrap; background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #fecaca; font-size: 12.5px; line-height: 1.5; color: #1a1a1a; overflow-x: auto;">${reasonMsg}\n\nStack: ${reasonStack || 'No stack trace'}</pre>
        <button onclick="window.location.reload()" style="margin-top: 16px; padding: 10px 18px; background: #c53030; color: white; border: none; borderRadius: 6px; cursor: pointer; font-weight: bold;">রিলোড করুন (Reload Page)</button>
      </div>
    `;
  }
});

// 2. React Error Boundary Component
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught exception inside React tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', background: '#fff5f5', color: '#c53030', fontFamily: 'monospace', borderRadius: '12px', border: '1px solid #feb2b2', margin: '24px', maxWidth: '800px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>ওয়েবসাইট লোড করতে ত্রুটি (Application Crash)</h2>
          <p style={{ fontSize: '13px', margin: '0 0 16px 0', color: '#742a2a' }}>এই ত্রুটির কারণে ওয়েবসাইটটি সাদা দেখাচ্ছে। নিচে বিস্তারিত দেওয়া হলো:</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '12.5px', lineHeight: '1.5', color: '#1a1a1a', overflowX: 'auto' }}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '16px', padding: '10px 18px', background: '#c53030', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            রিলোড করুন (Reload Page)
          </button>
        </div>
      );
    }

    return (this.props as any).children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
