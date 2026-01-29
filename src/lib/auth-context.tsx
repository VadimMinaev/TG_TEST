import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { username: string; userId: number | string } | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ username: string; userId: number | string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.authStatus();
      if (data.authenticated) {
        const userData = await api.me();
        setIsAuthenticated(true);
        setUser(userData);
      } else {
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setUser(null);
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
    setUser(userData);
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
