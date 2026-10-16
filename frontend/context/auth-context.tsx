"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCurrentUser,
  getStoredAuthToken,
  loginAccount,
  logoutAccount as apiLogout,
  registerAccount,
  LoginRequest,
  RegisterRequest,
  UserRead,
} from "@/services/api";

type AuthContextType = {
  user: UserRead | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch {
      // Token expired or invalid
      apiLogout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer the initial token check until after mount so auth loading does not cause a cascading render.
    const timer = window.setTimeout(() => {
      void fetchCurrentUser();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCurrentUser]);

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const res = await loginAccount(data);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      await registerAccount(data);
      // Auto login after register
      await login({
        username_or_email: data.username,
        password: data.password,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
