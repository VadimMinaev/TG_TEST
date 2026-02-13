import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface AuthUser {
  username: string;
  userId: number | string | null;
  accountId: number | null;
  accountSlug: string | null;
  role: 'administrator' | 'auditor';
  isVadmin: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 8000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Auth request timeout')), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await withTimeout(api.authStatus());
      if (data.authenticated) {
        const userData = await withTimeout(api.me());
        setIsAuthenticated(true);
        setUser({
          username: userData.username,
          userId: userData.userId ?? null,
          accountId: userData.accountId ?? null,
          accountSlug: userData.accountSlug ?? null,
          role: userData.role === 'auditor' ? 'auditor' : 'administrator',
          isVadmin: !!userData.isVadmin,
        });
      } else {
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setUser(null);
        if (data?.redirect && window.location.pathname !== data.redirect) {
          window.location.assign(data.redirect);
        }
      }
    } catch (error) {
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const data = await api.login(username, password);
    localStorage.setItem('authToken', data.token);
    const userData = await api.me();
    setIsAuthenticated(true);
    setUser({
      username: userData.username,
      userId: userData.userId ?? null,
      accountId: userData.accountId ?? null,
      accountSlug: userData.accountSlug ?? null,
      role: userData.role === 'auditor' ? 'auditor' : 'administrator',
      isVadmin: !!userData.isVadmin,
    });
  };

  const logout = async () => {
    await api.logout();
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
