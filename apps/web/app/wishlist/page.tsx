import { redirect } from "next/navigation";

export default async function WishlistRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ sub: "simulator" });
  if (typeof sp.month === "string") q.set("month", sp.month);
  if (typeof sp.year === "string") q.set("year", sp.year);
  redirect(`/credit?${q.toString()}`);
}
