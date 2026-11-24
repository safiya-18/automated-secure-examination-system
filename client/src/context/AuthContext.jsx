import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ases_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const currentUser = await authService.getMe();
        if (currentUser) {
          setUser(currentUser);
          localStorage.setItem('ases_user', JSON.stringify(currentUser));
        }
      } catch (err) {
        console.warn('Bootstrap auth check error:', err);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email, password, role = 'faculty') => {
    const res = await authService.login(email, password, role);
    if (res && res.user) {
      setUser(res.user);
      localStorage.setItem('ases_user', JSON.stringify(res.user));
    }
    return res;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const quickDemoLogin = async (role = 'faculty') => {
    const email = role === 'admin' ? 'admin@college.edu' : 'faculty@college.edu';
    const password = role === 'admin' ? 'AdminInitialPassword123!' : 'FacultySecret123!';
    return login(email, password, role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, quickDemoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

