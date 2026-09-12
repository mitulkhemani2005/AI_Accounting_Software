"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Building2, User as UserIcon, LogOut, Shield, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  const { user, tenant, logout, isAdmin, isStaff } = useAuth();

  return (
    <nav
      style={{
        height: "64px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand & Active Tenant */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#f8fafc" }}>
              {tenant?.business_name || "AI Accounting"}
            </div>
            {tenant?.gst_number && (
              <div style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                GSTIN: {tenant.gst_number}
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* User Info & Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {user ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isAdmin ? (
                <span className="badge badge-success">
                  <Shield size={12} /> Admin (Owner)
                </span>
              ) : (
                <span className="badge badge-blue">
                  <UserIcon size={12} /> Staff (Add-Only Billing)
                </span>
              )}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                  +91 {user.mobile_number}
                </div>
              </div>
            </div>

            <button onClick={logout} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.825rem" }}>
              <LogOut size={14} /> Logout
            </button>
          </>
        ) : (
          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/login" className="btn-secondary" style={{ padding: "8px 16px" }}>
              Log In
            </Link>
            <Link href="/signup" className="btn-primary" style={{ padding: "8px 16px" }}>
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
