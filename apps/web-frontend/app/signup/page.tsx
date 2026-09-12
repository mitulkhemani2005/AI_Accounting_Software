"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Building2, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const { signupAdmin } = useAuth();
  const [formData, setFormData] = useState({
    business_name: "",
    gst_number: "",
    admin_name: "",
    mobile_number: "",
    email: "",
    password: "",
    pin: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signupAdmin({
        business_name: formData.business_name,
        gst_number: formData.gst_number || undefined,
        admin_name: formData.admin_name,
        mobile_number: formData.mobile_number,
        email: formData.email || undefined,
        password: formData.password,
        pin: formData.pin || undefined,
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || "Signup failed. Please check your information and try again."
      );
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
          maxWidth: "520px",
          padding: "36px",
          borderRadius: "16px",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "6px" }}>
            Register Your Business
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Create your tenant workspace with multi-user RBAC & GST invoicing
          </p>
        </div>

        {error && (
          <div
            className="badge badge-danger"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "20px",
              display: "block",
              textAlign: "left",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Business Info */}
          <div>
            <label className="input-label">Business / Shop Legal Name *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Sharma Supermarket or Gupta Medicals"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label className="input-label">GSTIN (Optional)</label>
              <input
                type="text"
                maxLength={15}
                className="input-field"
                placeholder="27AABCU9603R1ZM"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="input-label">Owner Full Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Rajesh Sharma"
                value={formData.admin_name}
                onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label className="input-label">10-Digit Mobile *</label>
              <input
                type="tel"
                required
                maxLength={10}
                className="input-field"
                placeholder="9876543210"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              />
            </div>
            <div>
              <label className="input-label">Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="rajesh@store.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label className="input-label">Admin Password *</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-field"
                placeholder="Min. 6 chars"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <label className="input-label">Quick POS PIN (4-digit)</label>
              <input
                type="password"
                maxLength={6}
                className="input-field"
                placeholder="1234"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{ width: "100%", marginTop: "10px", padding: "12px" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Provisioning Tenant...
              </>
            ) : (
              <>
                Create Business Account <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
          }}
        >
          Already have a business account?{" "}
          <Link href="/login" style={{ color: "#38bdf8", fontWeight: 600 }}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
