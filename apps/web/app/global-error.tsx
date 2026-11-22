"use client";

import React from "react";
import { inferHttpStatusFromError } from "@/components/primitives/HttpErrorState";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const statusCode = inferHttpStatusFromError(error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          backgroundColor: "#0c0e14",
          color: "#f3f4f6",
          fontFamily: "system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "480px",
            backgroundColor: "#161922",
            border: "1px solid #282e3d",
            borderRadius: "8px",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              borderBottom: "1px solid #1f2430",
              paddingBottom: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <span
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "44px",
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {statusCode}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#ff3838",
                  letterSpacing: "0.06em",
                }}
              >
                CRITICAL_BOUNDARY_FAULT
              </span>
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#6b7280",
              }}
            >
              SUNDAY FUNDAY ERP
            </span>
          </div>

          <h1 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0" }}>
            Root application fault
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#9ca3af",
              lineHeight: 1.5,
              margin: "0 0 20px 0",
            }}
          >
            A root layout or transport exception occurred. Reload the route to
            re-establish the session.
          </p>

          {error?.digest && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#9ca3af",
                backgroundColor: "#11141c",
                border: "1px solid #1f2430",
                borderRadius: "4px",
                padding: "8px 12px",
                marginBottom: "18px",
              }}
            >
              Trace Digest: {error.digest}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                backgroundColor: "#242a38",
                color: "#f3f4f6",
                border: "1px solid #282e3d",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload Application
            </button>
            <a
              href="/"
              style={{
                backgroundColor: "#11141c",
                color: "#9ca3af",
                border: "1px solid #282e3d",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Return to Overview
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
