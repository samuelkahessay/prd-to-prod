import { api } from "@/lib/api";
import type { Run } from "@/lib/types";
import { RunsTable } from "@/components/console/runs-table";
import { cookies } from "next/headers";

export default async function RunsPage() {
  let runs: Run[] = [];
  try {
    const cookieHeader = (await cookies()).toString();
    runs = await api.listRuns({ cookieHeader });
  } catch {
    // API unavailable
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        All runs
      </h2>
      <RunsTable runs={runs} />
    </div>
  );
}
