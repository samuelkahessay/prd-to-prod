import { E2ERunDetail } from "@/components/console/e2e/run-detail";
import { api } from "@/lib/api";
import { cookies } from "next/headers";

export default async function E2ERunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();

  try {
    const [run, report] = await Promise.all([
      api.getE2ERun(id, { cookieHeader }),
      api.getE2EReport(id, { cookieHeader }),
    ]);

    return (
      <E2ERunDetail
        initialRun={run}
        initialReportMarkdown={report.reportMarkdown || ""}
      />
    );
  } catch {
    return <p>E2E run not found.</p>;
  }
}
