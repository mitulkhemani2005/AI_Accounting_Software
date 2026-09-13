"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Users,
  Building,
  Boxes,
} from "lucide-react";

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityType?: "items" | "customers" | "suppliers";
  initialEntityType?: "items" | "customers" | "suppliers";
}

export function CSVImportModal({
  isOpen,
  onClose,
  onSuccess,
  entityType: propEntityType,
  initialEntityType = "items",
}: CSVImportModalProps) {
  const [entityType, setEntityType] = useState<"items" | "customers" | "suppliers">(
    propEntityType || initialEntityType
  );

  React.useEffect(() => {
    if (propEntityType) {
      setEntityType(propEntityType);
    }
  }, [propEntityType, isOpen]);

  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [useRawText, setUseRawText] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Download Sample Template
  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/import/template/${entityType}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sample_${entityType.toUpperCase()}_Template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Template download failed:", err);
      setErrorMessage("Failed to download template. Please check connection.");
    }
  };

  // Execute Import
  const handleImport = async () => {
    setErrorMessage(null);
    setResultSummary(null);

    if (!useRawText && !file) {
      setErrorMessage("Please select a CSV file or paste raw CSV content to import.");
      return;
    }
    if (useRawText && !csvContent.trim()) {
      setErrorMessage("Please paste valid CSV content.");
      return;
    }

    setIsLoading(true);
    try {
      let res;
      if (!useRawText && file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await api.post(`/import/${entityType}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post(`/import/${entityType}`, {
          csv_content: csvContent.trim(),
        });
      }

      setResultSummary(res.data);
      if (res.data.success_count > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Import failed:", err);
      setErrorMessage(err.response?.data?.detail || "Import process encountered an error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "680px",
          borderRadius: "16px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Bulk CSV Data Import
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.825rem", margin: "4px 0 0 0" }}>
              Import existing legacy inventory items, opening stock, customers, and suppliers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: "6px 10px", borderRadius: "8px" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Entity Switcher Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
          {[
            { id: "items", label: "Products & Stock", icon: Boxes },
            { id: "customers", label: "Customers", icon: Users },
            { id: "suppliers", label: "Suppliers", icon: Building },
          ].map((tab) => {
            const isActive = entityType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setEntityType(tab.id as any);
                  setResultSummary(null);
                  setErrorMessage(null);
                }}
                className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                <tab.icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Template Download Banner */}
        <div
          style={{
            background: "rgba(37, 99, 235, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            padding: "12px 16px",
            borderRadius: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
            Need the correct column format? Download the sample template.
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.775rem", padding: "6px 12px" }}
          >
            <Download size={13} />
            <span>Sample Template</span>
          </button>
        </div>

        {/* Upload Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>
              {useRawText ? "Paste CSV Text" : "Upload CSV File"}
            </span>
            <button
              onClick={() => setUseRawText(!useRawText)}
              style={{
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                fontSize: "0.775rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {useRawText ? "Switch to File Upload" : "Switch to Direct Text Paste"}
            </button>
          </div>

          {!useRawText ? (
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "12px",
                padding: "28px",
                textAlign: "center",
                background: "#f8fafc",
                cursor: "pointer",
              }}
              onClick={() => document.getElementById("csv-file-input")?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <Upload size={32} color="#60a5fa" style={{ margin: "0 auto 8px auto" }} />
              <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                {file ? file.name : "Click to select or drag & drop CSV file"}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.775rem", marginTop: "4px" }}>
                Supports standard comma-separated .csv files
              </div>
            </div>
          ) : (
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste comma-separated rows with header line..."
              className="input-field"
              style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8rem", padding: "10px" }}
            />
          )}
        </div>

        {/* Feedback / Results */}
        {errorMessage && (
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {resultSummary && (
          <div
            style={{
              padding: "16px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                {resultSummary.message}
              </span>
              <div style={{ display: "flex", gap: "8px", fontSize: "0.8rem" }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>
                  ✓ {resultSummary.success_count} Success
                </span>
                {resultSummary.failed_count > 0 && (
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>
                    ✕ {resultSummary.failed_count} Failed
                  </span>
                )}
              </div>
            </div>

            {resultSummary.errors?.length > 0 && (
              <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                {resultSummary.errors.map((err: any, idx: number) => (
                  <div key={idx} style={{ color: "#fca5a5", marginBottom: "4px" }}>
                    • Row {err.row_number}: {err.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            <span>{isLoading ? "Importing Data..." : `Import ${entityType.toUpperCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
