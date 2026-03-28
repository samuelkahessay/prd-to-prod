import path from "path";

import { E2EDashboard } from "@/components/console/e2e/dashboard";
import { api } from "@/lib/api";
import type { E2ERun } from "@/lib/types";
import { cookies } from "next/headers";

export default async function E2EPage() {
  let runs: E2ERun[] = [];
  try {
    const cookieHeader = (await cookies()).toString();
    runs = await api.listE2ERuns({ cookieHeader });
  } catch {
    runs = [];
  }

  return (
    <E2EDashboard
      initialRuns={runs}
      defaultCookieJarPath={path.join(process.cwd(), "docs", "internal", ".e2e-cookiejar")}
    />
  );
}
