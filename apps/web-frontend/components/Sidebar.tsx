"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  Users,
  History,
  Package,
  BookOpen,
  FileText,
  Sparkles,
  Lock,
  Building,
  ClipboardCheck,
  Contact,
  Boxes,
  FileSpreadsheet,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, isStaff } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, allowed: true },
    { label: "POS Counter Sale", href: "/dashboard/pos", icon: Receipt, allowed: true },
    { label: "Sales & Invoices", href: "/dashboard/sales", icon: ShoppingBag, allowed: true },
    { label: "Products & Stock", href: "/dashboard/inventory", icon: Boxes, allowed: true },
    { label: "Purchase Book", href: "/dashboard/inventory?tab=purchases", icon: FileSpreadsheet, adminOnly: true },
    { label: "Parties & Ledger", href: "/dashboard/parties", icon: Contact, adminOnly: true },
    { label: "Accounting Engine", href: "/dashboard/accounting", icon: BookOpen, adminOnly: true },
    { label: "Staff Bills Review", href: "/dashboard/staff-bills", icon: ClipboardCheck, adminOnly: true },
    { label: "Staff & Sub-users", href: "/dashboard/staff", icon: Users, adminOnly: true },
    { label: "Audit Trail", href: "/dashboard/audit", icon: History, adminOnly: true },
  ];

  const upcomingModules = [
    { label: "Outstanding Reports", icon: FileText, phase: "Phase 5" },
    { label: "AI Suggestions", icon: Sparkles, phase: "Phase 7" },
  ];

  return (
    <aside
      style={{
        width: "260px",
        minHeight: "calc(100vh - 64px)",
        background: "rgba(15, 23, 42, 0.7)",
        borderRight: "1px solid var(--border)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        {/* Core Management */}
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            marginBottom: "12px",
            paddingLeft: "8px",
          }}
        >
          Tenant & Core Access
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const isRestricted = item.adminOnly && !isAdmin;

            return isRestricted ? (
              <div
                key={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  color: "#64748b",
                  fontSize: "0.9rem",
                  cursor: "not-allowed",
                  background: "rgba(30, 41, 59, 0.2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <item.icon size={18} color="#64748b" />
                  <span>{item.label}</span>
                </div>
                <Lock size={14} color="#ef4444" />
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#ffffff" : "var(--text-muted)",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(29, 78, 216, 0.2))"
                    : "transparent",
                  border: isActive ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <item.icon size={18} color={isActive ? "#60a5fa" : "#94a3b8"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Modules Roadmap Navigation */}
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            marginTop: "28px",
            marginBottom: "12px",
            paddingLeft: "8px",
          }}
        >
          Business Modules
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {upcomingModules.map((m) => (
            <div
              key={m.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.825rem",
                color: "var(--text-muted)",
                background: "rgba(30, 41, 59, 0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <m.icon size={16} color="#60a5fa" />
                <span>{m.label}</span>
              </div>
              <span className="badge badge-purple" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                {m.phase}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Role Notice Card */}
      <div
        className="glass-panel"
        style={{
          padding: "12px",
          borderRadius: "8px",
          borderLeft: isAdmin ? "3px solid #10b981" : "3px solid #3b82f6",
        }}
      >
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>
          {isAdmin ? "Admin Workspace" : "Staff Counter Mode"}
        </div>
        <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
          {isAdmin
            ? "Full access to books, inventory, staff, and audit trails."
            : "Add-only billing mode. Edit/delete restricted at API level."}
        </div>
      </div>
    </aside>
  );
}
