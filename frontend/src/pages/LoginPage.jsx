import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(err.message === 'account_suspended'
          ? 'Your account has been suspended'
          : 'Invalid username or password');
      } else {
        setError('Something went wrong — please try again');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 16,
        background: 'radial-gradient(ellipse at 60% 0%, rgba(37,99,235,0.12) 0%, transparent 60%), #101415',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 16, background: '#2563eb', marginBottom: 20,
              boxShadow: '0 0 0 8px rgba(37,99,235,0.12), 0 8px 24px rgba(37,99,235,0.3)',
            }}
          >
            <span className="msym msym-fill" style={{ fontSize: 28, color: '#eeefff' }}>deployed_code</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e0e3e5', letterSpacing: '-0.5px', margin: '0 0 4px' }}>
            Saw Yun LLC
          </h1>
          <p style={{ fontSize: 11, color: '#8d90a0', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
            Control Center
          </p>
        </div>

        <div style={{ background: '#1d2022', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(147,0,10,0.15)', border: '1px solid rgba(255,180,171,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
              <span className="msym" style={{ color: '#ffb4ab', fontSize: 18, flexShrink: 0 }}>error</span>
              <span style={{ fontSize: 13, color: '#ffb4ab', lineHeight: 1.4 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Username</label>
              <input
                type="text" required autoFocus placeholder="Enter your username"
                className="field-input" value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} required placeholder="Enter your password"
                  className="field-input" style={{ paddingRight: 44 }} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button" onClick={() => setShowPassword((s) => !s)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8d90a0', display: 'flex', alignItems: 'center', padding: 4, lineHeight: 1 }}
                >
                  <span className="msym" style={{ fontSize: 18 }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button type="submit" className="btn-signin" disabled={submitting}>
              {submitting ? 'Signing In…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#434655', marginTop: 20, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Saw Yun LLC — Internal Admin Panel
        </p>
      </div>
    </div>
  );
}
