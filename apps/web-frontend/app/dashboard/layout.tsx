"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { FundSafeTopMenu } from "@/components/FundSafeTopMenu";

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
          backgroundColor: "#ffffff",
        }}
      >
        <Loader2 className="animate-spin" size={36} color="#2563eb" />
        <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Loading FundSafe workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", color: "#0f172a" }}>
      <FundSafeTopMenu />
      <main style={{ flex: 1, padding: "0", overflowY: "auto", maxWidth: "100%", width: "100%", backgroundColor: "#ffffff" }}>
        {children}
      </main>
    </div>
  );
}
