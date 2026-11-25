import type { Metadata } from "next";
import { Suspense } from "react";
import { QrGallery } from "@/components/qr-gallery";
import { PageSkeleton } from "@/components/widgets";

export const metadata: Metadata = { title: "QR Codes" };

export default function QrPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QrGallery />
    </Suspense>
  );
}
