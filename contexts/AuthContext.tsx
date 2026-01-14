import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { useAuth0 } from "@auth0/auth0-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: () => Promise<void>; // Simplified signature as Auth0 handles the form
  register: () => Promise<void>; // Simplified signature
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    user: auth0User, 
    isAuthenticated, 
    isLoading: isAuth0Loading, 
    loginWithRedirect, 
    logout: auth0Logout,
    error: auth0Error
  } = useAuth0();

  const [appUser, setAppUser] = useState<User | null>(null);

  // Map Auth0 user to App User type
  useEffect(() => {
    if (isAuthenticated && auth0User) {
      setAppUser({
        id: auth0User.sub || 'unknown',
        name: auth0User.name || auth0User.email || 'User',
        email: auth0User.email || '',
        photoURL: auth0User.picture
      });
    } else {
      setAppUser(null);
    }
  }, [isAuthenticated, auth0User]);

  const loginWithGoogle = async () => {
    // Specifically target Google connection if configured, otherwise generic login
    await loginWithRedirect({ 
      authorizationParams: { connection: 'google-oauth2' } 
    });
  };

  const loginWithEmail = async () => {
    // Standard Universal Login
    await loginWithRedirect();
  };

  const register = async () => {
    // Redirect to signup page
    await loginWithRedirect({ 
      authorizationParams: { screen_hint: 'signup' } 
    });
  };

  const logout = () => {
    auth0Logout({ 
      logoutParams: { returnTo: window.location.origin } 
    });
  };

  const clearError = () => {
    // Auth0 error is managed by the hook, but we can provide a no-op if downstream components expect it
  };

  return (
    <AuthContext.Provider value={{ 
      user: appUser, 
      isLoading: isAuth0Loading, 
      error: auth0Error ? auth0Error.message : null, 
      loginWithGoogle, 
      loginWithEmail, 
      register, 
      logout,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};