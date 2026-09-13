"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ItemsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/inventory");
  }, [router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
      <Loader2 size={36} className="animate-spin" color="#38bdf8" />
      <div style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
        Redirecting to unified <strong>Products & Inventory Master</strong>...
      </div>
    </div>
  );
}
