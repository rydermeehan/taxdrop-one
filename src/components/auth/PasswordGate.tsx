import { useState, useEffect } from 'react';

interface PasswordGateProps {
  children: React.ReactNode;
  password: string;
}

const STORAGE_KEY = 'taxdrop-studio-auth';

export function PasswordGate({ children, password }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue === password) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setInputValue('');
    }
  };

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--td-mint)',
      }}>
        <div style={{ color: 'var(--td-emerald-dark)' }}>Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--td-mint) 0%, #fff 100%)',
    }}>
      <div style={{
        background: 'white',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--td-emerald-light)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: 'var(--td-charcoal)',
          marginBottom: '8px',
          fontFamily: '"Space Grotesk", sans-serif',
        }}>
          TaxDrop Studio
        </h1>

        <p style={{
          color: 'var(--color-gray-500)',
          marginBottom: '32px',
          fontSize: '14px',
        }}>
          Enter password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: '16px',
              border: error ? '2px solid var(--color-error)' : '2px solid #E5E7EB',
              borderRadius: '8px',
              marginBottom: '16px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--td-emerald-light)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error ? 'var(--color-error)' : '#E5E7EB';
            }}
          />

          {error && (
            <p style={{
              color: 'var(--color-error)',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              Incorrect password
            </p>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: '600',
              background: 'var(--td-emerald-dark)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--td-emerald-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--td-emerald-dark)';
            }}
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
