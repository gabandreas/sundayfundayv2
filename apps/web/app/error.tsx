"use client";

import React, { useEffect } from "react";
import { HttpErrorState, inferHttpStatusFromError } from "@/components/primitives/HttpErrorState";

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AppErrorBoundary:", error);
  }, [error]);

  const statusCode = inferHttpStatusFromError(error);

  return (
    <HttpErrorState
      statusCode={statusCode}
      detailMessage={
        process.env.NODE_ENV === "development" ? error.message : undefined
      }
      digest={error.digest}
      onRetry={() => reset()}
    />
  );
}
