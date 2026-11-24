import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Mail, 
  Sparkles, 
  KeyRound, 
  AlertCircle,
  GraduationCap,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login, quickDemoLogin } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('faculty');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, role);
      navigate(role === 'admin' ? '/admin' : '/faculty');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (selectedRole) => {
    setError('');
    setLoading(true);
    try {
      await quickDemoLogin(selectedRole);
      navigate(selectedRole === 'admin' ? '/admin' : '/faculty');
    } catch (err) {
      setError('Demo login failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-cream)',
      display: 'flex',
      alignItems: 'stretch',
      padding: '24px',
      gap: '24px',
      position: 'relative'
    }}>
      {/* Left Editorial Hero Section (Inspired by Reference 1 & 3) */}
      <div style={{
        flex: 1.15,
        backgroundColor: '#EBE5D8',
        borderRadius: '28px',
        border: '2px solid var(--border-dark)',
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-neo)'
      }}>
        {/* Top Header & Stamp */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              backgroundColor: 'var(--accent-yellow)',
              borderRadius: '999px',
              border: '2px solid var(--border-dark)',
              fontSize: '0.8rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '20px',
              boxShadow: 'var(--shadow-neo-sm)'
            }}>
              <Sparkles size={16} /> Secure Exam Architecture 2.0
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.4rem',
              letterSpacing: '-0.02em',
              color: 'var(--dark-text)'
            }}>
              ASES<span style={{ color: 'var(--primary-cobalt)' }}>.SYSTEM</span>
            </div>
          </div>

          {/* Rotating Seal Stamp (Reference 1) */}
          <div style={{
            position: 'relative',
            width: '100px',
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg
              className="seal-rotate"
              viewBox="0 0 100 100"
              style={{ width: '100%', height: '100%' }}
            >
              <path
                id="textPath"
                d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
                fill="none"
              />
              <text fontSize="8.5" fontWeight="800" letterSpacing="2.8" fill="var(--dark-text)">
                <textPath href="#textPath">
                  • ASES OFFICIAL SECURE EXAMS •
                </textPath>
              </text>
            </svg>
            <div style={{
              position: 'absolute',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-cobalt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              <ShieldCheck size={22} />
            </div>
          </div>
        </div>

        {/* Oversized Bold Headline (Reference 1 & 3) */}
        <div style={{ margin: '40px 0' }}>
          <h1 className="text-editorial-xl" style={{ color: 'var(--dark-text)', marginBottom: '16px' }}>
            INTEGRITY FIRST.<br />
            <span style={{ color: 'var(--primary-cobalt)' }}>ZERO COMPROMISE.</span>
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: 'var(--muted-text)',
            maxWidth: '480px',
            lineHeight: 1.6,
            fontWeight: 500
          }}>
            Automated student-specific question subsets, cryptographic Fisher-Yates shuffle, real-time proctoring telemetry, and strict lifecycle enforcement.
          </p>
        </div>

        {/* Highlight Feature Badges (Reference 3 edtech tiles) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          <div style={{
            backgroundColor: 'var(--card-white)',
            border: '2px solid var(--border-dark)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: 'var(--shadow-neo-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary-cobalt)' }}></span>
              Subset Distribution
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>
              Configurable question quotas with unbiased Fisher-Yates combinatorial shuffling.
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--accent-lavender)',
            border: '2px solid var(--border-dark)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: 'var(--shadow-neo-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8E54E9' }}></span>
              Anti-Cheat Telemetry
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>
              Full-screen lockdown, tab-blur audit trails, and student identity verification.
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Form Section (Reference 2 Card Style + Neo-Brutalism) */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 32px'
      }}>
        <div className="card-neo" style={{ padding: '40px', backgroundColor: '#FFFFFF', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
          
          {/* Form Header */}
          <div style={{ marginBottom: '28px' }}>
            <div className="badge-pill badge-pink" style={{ marginBottom: '12px' }}>
              ACADEMIC CREDENTIALS
            </div>
            <h2 className="text-editorial-lg" style={{ fontSize: '2.1rem', color: 'var(--dark-text)', marginBottom: '8px' }}>
              Sign In to Portal
            </h2>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.92rem' }}>
              Enter your institutional credentials or use the 1-Click Demo buttons below.
            </p>
          </div>

          {/* Role Toggle Tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-cream)',
            border: '2px solid var(--border-dark)',
            borderRadius: '14px',
            padding: '4px',
            marginBottom: '24px',
            gap: '4px'
          }}>
            <button
              type="button"
              onClick={() => setRole('faculty')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: role === 'faculty' ? 'var(--primary-cobalt)' : 'transparent',
                color: role === 'faculty' ? '#FFFFFF' : 'var(--dark-text)',
                transition: 'all 0.15s ease'
              }}
            >
              <GraduationCap size={18} />
              <span>Faculty / Lecturer</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('admin')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: role === 'admin' ? 'var(--border-dark)' : 'transparent',
                color: role === 'admin' ? '#FFFFFF' : 'var(--dark-text)',
                transition: 'all 0.15s ease'
              }}
            >
              <ShieldAlert size={18} />
              <span>Super Admin</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#FFEBEB',
              border: '2px solid #FF5252',
              borderRadius: '12px',
              color: '#D32F2F',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '20px'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Institutional Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="input-neo"
                  placeholder={role === 'admin' ? 'admin@college.edu' : 'faculty@college.edu'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '42px' }}
                />
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--light-muted)' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-neo"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '42px' }}
                />
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--light-muted)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-neo btn-cobalt"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '6px' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Workspace'}
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Development-Only Demo Login Section (Strictly restricted to DEV mode) */}
          {import.meta.env.DEV && (
            <>
              <div style={{
                position: 'relative',
                textAlign: 'center',
                margin: '28px 0 16px',
              }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed var(--border-subtle)' }}></div>
                <span style={{
                  position: 'relative',
                  backgroundColor: '#FFFFFF',
                  padding: '0 10px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--muted-text)',
                  letterSpacing: '0.06em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FF9800' }}></span>
                  DEV MODE TEST SHORTCUTS
                </span>
              </div>

              {/* 1-Click Demo Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin('faculty')}
                  className="btn-neo btn-yellow"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <KeyRound size={15} /> Demo as Faculty (Dr. Vance)
                  </span>
                  <span style={{ fontSize: '0.75rem', textDecoration: 'underline' }}>Auto-Fill</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin('admin')}
                  className="btn-neo btn-white"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={15} /> Demo as Super Administrator
                  </span>
                  <span style={{ fontSize: '0.75rem', textDecoration: 'underline' }}>Auto-Fill</span>
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
              Are you a student attending an exam?{' '}
              <a 
                href="/attend" 
                onClick={(e) => { e.preventDefault(); navigate('/attend'); }}
                style={{ color: 'var(--primary-cobalt)', fontWeight: 700, textDecoration: 'underline' }}
              >
                Go to Direct Exam Access &rarr;
              </a>
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}

