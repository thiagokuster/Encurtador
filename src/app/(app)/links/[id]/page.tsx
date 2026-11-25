import type { Metadata } from "next";
import { LinkDetail } from "@/components/link-detail";

export const metadata: Metadata = { title: "Link" };

export default async function LinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LinkDetail id={id} />;
}
