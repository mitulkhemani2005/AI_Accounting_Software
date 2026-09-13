"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Users, Plus, Shield, User as UserIcon, Lock, Check, X, Loader2, AlertCircle } from "lucide-react";
import { UpgradePaywall } from "@/components/UpgradePaywall";

export default function StaffPage() {
  const { isAdmin, tenant, entitlements } = useAuth();
  const isFreePlan = (tenant?.subscription_tier || "free").toLowerCase() === "free";
  const isLocked = isFreePlan && !entitlements.includes("sub_users");

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", mobile_number: "", pin: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      setError(err.response?.data?.detail || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post("/users/sub-users", {
        name: formData.name,
        mobile_number: formData.mobile_number,
        pin: formData.pin,
        email: formData.email || undefined,
        role_name: "sub_user",
      });
      setSuccessMsg(`Staff member ${formData.name} added successfully!`);
      setShowModal(false);
      setFormData({ name: "", mobile_number: "", pin: "", email: "" });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to create staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.put(`/users/${userId}/status`, { is_active: !currentStatus });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update user status");
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
        <Lock size={48} color="#ef4444" style={{ margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
          Access Restricted: Admin Only
        </h2>
        <p style={{ color: "var(--text-muted)", maxWidth: "450px", margin: "0 auto" }}>
          Sub-users and staff members do not have permission to view or manage users. This rule is
          enforced at the server API level.
        </p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <UpgradePaywall
        moduleName="Staff & Sub-Users"
        title="Unlock Multi-User Staff & Role Management"
        subtitle="Free tier is restricted to single store-owner admin access. Upgrade to Standard Plan to create fast 4-digit PIN counter logins for billing staff."
        requiredPlan="Standard Business"
        priceMonthly="₹499 / mo"
        features={[
          "Up to 5 Store Staff Sub-Users on Standard Plan (Unlimited on Enterprise)",
          "4-6 Digit Fast Counter POS PIN Authentication",
          "Add-Only Role Protections (Staff restricted from editing/deleting past bills)",
          "Two-Stage Staff Bill Review & Store Owner Confirmation Queue",
          "User-wise Counter Sales Tracking & Daily Closing Registers",
        ]}
      />
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "4px" }}>
            Staff & Sub-User Management
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Manage counter staff, set 4-digit POS PINs, and control access permissions
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={18} /> Add New Staff Member
        </button>
      </div>

      {successMsg && (
        <div
          className="badge badge-success"
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            display: "block",
            fontSize: "0.875rem",
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: "var(--text-muted)" }}>Loading staff list...</div>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile Number</th>
                <th>Role & Permissions</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    {u.email && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>}
                  </td>
                  <td>+91 {u.mobile_number}</td>
                  <td>
                    {u.role_name === "admin" ? (
                      <span className="badge badge-success">
                        <Shield size={12} /> Admin (Owner)
                      </span>
                    ) : (
                      <span className="badge badge-blue">
                        <UserIcon size={12} /> Sub-user (Add-Only Billing)
                      </span>
                    )}
                  </td>
                  <td>
                    {u.is_active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Deactivated</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>
                    {new Date(u.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td>
                    {u.role_name !== "admin" && (
                      <button
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                        className={u.is_active ? "btn-danger" : "btn-secondary"}
                        style={{ padding: "4px 10px", fontSize: "0.775rem" }}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "30px",
              borderRadius: "14px",
              background: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Add Staff Member</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div
                className="badge badge-danger"
                style={{ width: "100%", padding: "8px 12px", marginBottom: "16px", display: "block" }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleAddStaff} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="input-label">Staff Full Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Staff 10-Digit Mobile *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  className="input-field"
                  placeholder="9811223344"
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">4-6 Digit Quick POS PIN *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  maxLength={6}
                  className="input-field"
                  placeholder="e.g. 5678"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                />
                <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Staff will use this PIN for rapid counter sales login.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
