import { BuildStatus } from "@/components/build/build-status";
import { buildApi } from "@/lib/build-api";

export default async function BuildStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const { session, messages } = await buildApi.getSession(id);
    return <BuildStatus initialEvents={messages} initialSession={session} />;
  } catch {
    return <p>Build session not found.</p>;
  }
}
