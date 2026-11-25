import { redirect } from "next/navigation";

export default async function PaydayWizardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ sub: "closing" });
  if (typeof sp.month === "string") q.set("month", sp.month);
  if (typeof sp.year === "string") q.set("year", sp.year);
  redirect(`/payroll?${q.toString()}`);
}
