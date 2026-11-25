import type { Metadata } from "next";
import { Suspense } from "react";
import { LinksManager } from "@/components/links-manager";
import { PageSkeleton } from "@/components/widgets";

export const metadata: Metadata = { title: "Meus links" };

export default function LinksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LinksManager />
    </Suspense>
  );
}
