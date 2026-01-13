/**
 * AuthContext - Authentication state management
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_BASE = 'https://amzsellmetrics.iwa.web.tr/api';

type UserRole = 'admin' | 'editor' | 'viewer';

interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearMustChangePassword: () => void;
  isAdmin: boolean;
  isEditor: boolean;
  canEdit: boolean; // admin or editor can edit
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          // Verify token with backend
          const response = await fetch(`${API_BASE}/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setState({
                user: data.data.user,
                token: storedToken,
                isLoading: false,
                isAuthenticated: true,
              });
              return;
            }
          }
        } catch (error) {
          console.error('[Auth] Token verification failed:', error);
        }
      }

      // Clear invalid data
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const { token, user } = data.data;

        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });

        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        // Clear the mustChangePassword flag locally
        if (state.user) {
          const updatedUser = { ...state.user, mustChangePassword: false };
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
          setState(prev => ({
            ...prev,
            user: updatedUser,
          }));
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Password change failed' };
      }
    } catch (error: any) {
      console.error('[Auth] Change password error:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  }, [state.token, state.user]);

  const clearMustChangePassword = useCallback(() => {
    if (state.user) {
      const updatedUser = { ...state.user, mustChangePassword: false };
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setState(prev => ({
        ...prev,
        user: updatedUser,
      }));
    }
  }, [state.user]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    changePassword,
    clearMustChangePassword,
    isAdmin: state.user?.role === 'admin',
    isEditor: state.user?.role === 'editor',
    canEdit: state.user?.role === 'admin' || state.user?.role === 'editor',
    mustChangePassword: state.user?.mustChangePassword || false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
