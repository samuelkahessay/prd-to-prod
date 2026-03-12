import { ConsoleNav } from "@/components/console/console-nav";
import { api } from "@/lib/api";
import { cookies } from "next/headers";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let queueCount = 0;
  let pipelineHealthy = true;

  try {
    const cookieHeader = (await cookies()).toString();
    const queue = await api.getQueue({ cookieHeader });
    queueCount = queue.length;
    const checks = await api.preflight({ cookieHeader });
    pipelineHealthy = checks.filter((c) => c.required).every((c) => c.present);
  } catch {
    // API unavailable — show degraded state
    pipelineHealthy = false;
  }

  return (
    <>
      <ConsoleNav queueCount={queueCount} pipelineHealthy={pipelineHealthy} />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 32 }}>
        {children}
      </div>
    </>
  );
}
