"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Building2, Shield, User as UserIcon, KeyRound, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { loginAdmin, loginStaff } = useAuth();
  const [tab, setTab] = useState<"admin" | "staff">("admin");

  // Admin form
  const [adminIdentifier, setAdminIdentifier] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Staff form
  const [staffMobile, setStaffMobile] = useState("");
  const [staffPin, setStaffPin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginAdmin(adminIdentifier, adminPassword);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginStaff(staffMobile, staffPin);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Invalid mobile number or PIN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "36px",
          borderRadius: "16px",
        }}
      >
        {/* Logo & Title */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <Building2 size={26} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "4px" }}>
            Sign In to Workspace
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Select your role to access your billing & accounting dashboard
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            background: "#f1f5f9",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "24px",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab("admin");
              setError(null);
            }}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: tab === "admin" ? "#2563eb" : "transparent",
              color: tab === "admin" ? "#ffffff" : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            <Shield size={16} /> Admin (Owner)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("staff");
              setError(null);
            }}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: tab === "staff" ? "#2563eb" : "transparent",
              color: tab === "staff" ? "#ffffff" : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            <UserIcon size={16} /> Staff POS (PIN)
          </button>
        </div>

        {error && (
          <div
            className="badge badge-danger"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "18px",
              display: "block",
              textAlign: "left",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Admin Login Form */}
        {tab === "admin" && (
          <form onSubmit={handleAdminSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="input-label">Email or Mobile Number</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="rajesh@store.in or 9876543210"
                value={adminIdentifier}
                onChange={(e) => setAdminIdentifier(e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">Password</label>
              <input
                type="password"
                required
                className="input-field"
                placeholder="Enter password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: "100%", marginTop: "8px", padding: "12px" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Authenticating...
                </>
              ) : (
                <>
                  Admin Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Staff PIN Login Form */}
        {tab === "staff" && (
          <form onSubmit={handleStaffSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="input-label">Staff 10-Digit Mobile Number</label>
              <input
                type="tel"
                required
                maxLength={10}
                className="input-field"
                placeholder="9111223344"
                value={staffMobile}
                onChange={(e) => setStaffMobile(e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">Staff 4-6 Digit POS PIN</label>
              <input
                type="password"
                required
                maxLength={6}
                className="input-field"
                placeholder="Enter PIN"
                value={staffPin}
                onChange={(e) => setStaffPin(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: "100%", marginTop: "8px", padding: "12px" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Verifying PIN...
                </>
              ) : (
                <>
                  Staff Quick Login <KeyRound size={18} />
                </>
              )}
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
          }}
        >
          New store owner?{" "}
           <Link href="/signup" style={{ color: "#2563eb", fontWeight: 600 }}>
            Register your business
          </Link>
        </div>
      </div>
    </div>
  );
}
