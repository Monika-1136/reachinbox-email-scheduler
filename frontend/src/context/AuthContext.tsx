import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithGoogle: () => void;
  loginWithDev: (email?: string, name?: string) => Promise<void>;
  loginWithDemo: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('reachinbox_token'));
  const [loading, setLoading] = useState(true);

  // Check URL query parameters for Google OAuth callback token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      localStorage.setItem('reachinbox_token', urlToken);
      setToken(urlToken);
      // Clean query parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const storedToken = localStorage.getItem('reachinbox_token');
      if (storedToken) {
        const userData = await authApi.getMe();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      localStorage.removeItem('reachinbox_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const loginWithGoogle = () => {
    const apiBase = (import.meta as any).env?.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/auth/google`;
  };

  const loginWithDev = async (email = 'demo@reachinbox.ai', name = 'ReachInbox Demo User') => {
    setLoading(true);
    try {
      const data = await authApi.devLogin(email, name);
      localStorage.setItem('reachinbox_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('reachinbox_token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithGoogle,
        loginWithDev,
        loginWithDemo: loginWithDev,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
