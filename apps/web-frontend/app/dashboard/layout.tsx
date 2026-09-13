"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ERPHeader } from "@/components/erp/ERPHeader";
import { ERPStatusBar } from "@/components/erp/ERPStatusBar";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, mounted, router]);

  if (!mounted || isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          backgroundColor: "#0b132b",
        }}
      >
        <Loader2 className="animate-spin" size={36} color="#3b82f6" />
        <div style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="erp-window-frame" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <ERPHeader />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", background: "#f1f5f9" }}>
        {children}
      </main>
      <ERPStatusBar />
    </div>
  );
}
