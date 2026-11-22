import React from "react";
import { UserGuideClientView } from "@/components/guide/UserGuideClientView";
import { getDefaultPayrollPeriod } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month =
    typeof params.month === "string" && parseInt(params.month, 10)
      ? parseInt(params.month, 10)
      : defaultPeriod.month;
  const year =
    typeof params.year === "string" && parseInt(params.year, 10)
      ? parseInt(params.year, 10)
      : defaultPeriod.year;

  return <UserGuideClientView month={month} year={year} />;
}
