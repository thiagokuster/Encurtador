import type { Metadata } from "next";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <h2>Nova senha</h2>
      <div style={{ marginTop: "1rem" }}><ResetForm token={params.token || ""} /></div>
    </>
  );
}
