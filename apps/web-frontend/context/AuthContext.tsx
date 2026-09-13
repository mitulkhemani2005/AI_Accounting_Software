"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  name: string;
  mobile_number: string;
  email?: string | null;
  role: string;
}

export interface Tenant {
  id: string;
  business_name: string;
  legal_name?: string | null;
  gst_number?: string | null;
  subscription_tier: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  terms_conditions?: string | null;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  permissions: string[];
  entitlements: string[];
  isLoading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  loginAdmin: (identifier: string, pass: string) => Promise<void>;
  loginStaff: (mobile: string, pin: string) => Promise<void>;
  signupAdmin: (payload: any) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const handleAuthSuccess = (data: any) => {
    setUser(data.user);
    setTenant(data.tenant);
    setToken(data.access_token);
    setPermissions(data.permissions || []);
    setEntitlements(data.entitlements || []);

    localStorage.setItem("auth_token", data.access_token);
    localStorage.setItem("auth_session", JSON.stringify(data));
  };

  const refreshProfile = async () => {
    try {
      if (typeof window === "undefined") return;
      
      const storedToken = localStorage.getItem("auth_token");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      const sessionStr = localStorage.getItem("auth_session");
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          setUser(session.user);
          setTenant(session.tenant);
          setPermissions(session.permissions || []);
          setEntitlements(session.entitlements || []);
        } catch (e) {
          console.error("Failed to parse cached session:", e);
        }
      }

      // Fetch fresh profile from API
      const res = await api.get("/auth/me");
      if (res.data) {
        const freshUser = {
          id: res.data.id,
          name: res.data.name,
          mobile_number: res.data.mobile_number,
          email: res.data.email,
          role: res.data.role,
        };
        const freshTenant = res.data.tenant || null;
        const freshPermissions = res.data.permissions || [];
        const freshEntitlements = res.data.entitlements || [];

        setUser(freshUser);
        if (freshTenant) {
          setTenant(freshTenant);
        }
        setPermissions(freshPermissions);
        setEntitlements(freshEntitlements);

        // Persist fresh session to localStorage
        localStorage.setItem(
          "auth_session",
          JSON.stringify({
            access_token: storedToken,
            user: freshUser,
            tenant: freshTenant,
            permissions: freshPermissions,
            entitlements: freshEntitlements,
          })
        );
      }
    } catch (err: any) {
      console.warn("Session validation error:", err?.message || err);
      // Only clear if 401 Unauthorized
      if (err.response?.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_session");
        setUser(null);
        setTenant(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const loginAdmin = async (login_identifier: string, password: string) => {
    const res = await api.post("/auth/login-admin", { login_identifier, password });
    handleAuthSuccess(res.data);
    router.push("/dashboard");
  };

  const loginStaff = async (mobile_number: string, pin: string) => {
    const res = await api.post("/auth/login-staff", { mobile_number, pin });
    handleAuthSuccess(res.data);
    router.push("/dashboard");
  };

  const signupAdmin = async (payload: any) => {
    const res = await api.post("/auth/signup-admin", payload);
    handleAuthSuccess(res.data);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_session");
    setUser(null);
    setTenant(null);
    setToken(null);
    setPermissions([]);
    setEntitlements([]);
    router.push("/login");
  };

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "sub_user";

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        permissions,
        entitlements,
        isLoading,
        isAdmin,
        isStaff,
        loginAdmin,
        loginStaff,
        signupAdmin,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
