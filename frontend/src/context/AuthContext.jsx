import { useState, useEffect } from 'react';
import authService from '../services/authService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { AuthContext } from './authContextDef';

/**
 * Enterprise AuthProvider
 * Strictly enforces Supabase Auth sessions verified via supabase.auth.getSession()
 * and synchronized in real-time via supabase.auth.onAuthStateChange().
 * Zero mock sessions or demo bypasses.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(
    () => isSupabaseConfigured() && Boolean(supabase)
  );

  // Synchronize active Supabase session on startup and state changes
  useEffect(() => {
    let mounted = true;

    if (isSupabaseConfigured() && supabase) {
      authService
        .getInitialSession()
        .then((initialUser) => {
          if (mounted) {
            setUser(initialUser);
          }
        })
        .finally(() => {
          if (mounted) {
            setIsInitializing(false);
          }
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            setUser(authService._mapSupabaseUser(session.user));
          } else {
            setUser(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });

      return () => {
        mounted = false;
        subscription?.unsubscribe();
      };
    }
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const authenticatedUser = await authService.login(credentials);
      setUser(authenticatedUser);
      return authenticatedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData) => {
    setIsLoading(true);
    try {
      const newUser = await authService.signup(userData);
      // Only set active session user if email confirmation is not pending
      if (!newUser.emailConfirmationPending) {
        setUser(newUser);
      }
      return newUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading: isLoading || isInitializing,
        isCloudConfigured: isSupabaseConfigured(),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
