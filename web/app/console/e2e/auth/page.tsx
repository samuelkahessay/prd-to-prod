import { Suspense } from "react";

import { E2EAuthExport } from "@/components/console/e2e/auth-export";

export default function E2EAuthPage() {
  return (
    <Suspense fallback={<p>Loading auth bootstrap…</p>}>
      <E2EAuthExport />
    </Suspense>
  );
}
