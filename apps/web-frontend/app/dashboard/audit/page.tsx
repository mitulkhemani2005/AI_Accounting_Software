"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { History, Shield, Lock, Loader2, Eye, Terminal } from "lucide-react";

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/tenants/audit-logs");
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAuditLogs();
    }
  }, [isAdmin]);

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "CREATE":
        return <span className="badge badge-success">CREATE</span>;
      case "UPDATE":
      case "UPDATE_STATUS":
        return <span className="badge badge-warning">UPDATE</span>;
      case "DELETE":
        return <span className="badge badge-danger">DELETE</span>;
      case "LOGIN":
        return <span className="badge badge-blue">LOGIN</span>;
      default:
        return <span className="badge badge-purple">{action}</span>;
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
          Only Store Owners and Admins have access to the immutable compliance audit log.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <History size={24} color="#60a5fa" />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Security & Compliance Audit Trail</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Immutable record of all tenant activities, logins, creation, updates, and permission changes
        </p>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: "var(--text-muted)" }}>Loading audit records...</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            No audit logs found.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Client IP</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.825rem", whiteSpace: "nowrap" }}>
                    {new Date(log.created_at).toLocaleString("en-IN")}
                  </td>
                  <td>{getActionBadge(log.action)}</td>
                  <td style={{ fontWeight: 600 }}>{log.entity_type}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.775rem", color: "var(--text-muted)" }}>
                    {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : "—"}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {log.ip_address || "127.0.0.1"}
                  </td>
                  <td>
                    {log.details && (
                      <button
                        onClick={() => setSelectedDetails(log.details)}
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        <Eye size={12} /> View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Details Modal */}
      {selectedDetails && (
        <div className="modal-overlay" onClick={() => setSelectedDetails(null)}>
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              borderRadius: "12px",
              background: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Terminal size={18} color="#38bdf8" />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Audit Event Metadata</h3>
            </div>
            <pre
              style={{
                background: "#1e293b",
                padding: "16px",
                borderRadius: "8px",
                overflowX: "auto",
                fontSize: "0.8rem",
                color: "#10b981",
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(selectedDetails, null, 2)}
            </pre>
            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <button onClick={() => setSelectedDetails(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
