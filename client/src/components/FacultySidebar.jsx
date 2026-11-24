import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpenCheck, 
  BarChart3, 
  Layers, 
  Settings, 
  LogOut,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FacultySidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', to: '/faculty', icon: LayoutDashboard },
    { label: 'My Quizzes', to: '/faculty/quizzes', icon: BookOpenCheck },
    { label: 'Results & Analytics', to: '/faculty/results', icon: BarChart3 },
    { label: 'Question Bank', to: '/faculty/questions', icon: Layers },
    { label: 'Settings', to: '/faculty/settings', icon: Settings },
  ];

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--sidebar-dark)',
      borderRadius: '24px',
      margin: '16px 0 16px 16px',
      padding: '28px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      color: 'var(--sidebar-text)',
      boxShadow: 'var(--shadow-neo)',
      border: '2px solid var(--border-dark)',
      height: 'calc(100vh - 32px)',
      position: 'sticky',
      top: '16px',
      flexShrink: 0
    }}>
      {/* Top Profile / Brand */}
      <div>
        {/* Brand Seal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'var(--primary-cobalt)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            border: '2px solid #FFFFFF'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.2rem',
              letterSpacing: '-0.02em',
              color: '#FFFFFF'
            }}>
              ASES<span style={{ color: 'var(--accent-yellow)' }}>.</span>
            </div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A59EC2' }}>
              EXAMINATION PORTAL
            </div>
          </div>
        </div>

        {/* User Card matching Reference 2 */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '18px',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '28px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'var(--secondary-pink)',
            border: '2px solid #FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: 'var(--dark-text)',
            flexShrink: 0
          }}>
            {user?.name?.charAt(0) || 'P'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}>
              {user?.name || 'Faculty Member'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span className="badge-pill badge-yellow" style={{ fontSize: '0.65rem', padding: '2px 8px', border: 'none' }}>
                {user?.role?.toUpperCase() || 'FACULTY'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/faculty'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#A59EC2',
                  border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                })}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div>
        <div style={{
          backgroundColor: 'rgba(233, 221, 245, 0.08)',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '16px',
          border: '1px dashed rgba(255,255,255,0.18)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-yellow)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            <Sparkles size={14} /> Anti-Cheat Shield
          </div>
          <div style={{ fontSize: '0.75rem', color: '#B3ACD0', lineHeight: 1.4 }}>
            Full screen lock, tab-switch telemetry, and randomized question dispatch enabled.
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '14px',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#FF8A8A',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 138, 138, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

