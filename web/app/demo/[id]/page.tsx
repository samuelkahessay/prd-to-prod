import { redirect } from "next/navigation";
import { DemoSession } from "@/components/demo/demo-session";
import { buildApi } from "@/lib/build-api";
import { normalizeDemoReplayPreset } from "@/lib/demo-preset";

export default async function DemoSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    e2e_repo_name?: string | string[] | undefined;
    preset?: string | string[] | undefined;
  }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ||
      Promise.resolve<{
        e2e_repo_name?: string | string[] | undefined;
        preset?: string | string[] | undefined;
      }>({}),
  ]);
  const requestedRepoName =
    typeof resolvedSearchParams?.e2e_repo_name === "string"
      ? resolvedSearchParams.e2e_repo_name
      : null;
  const replayPreset = normalizeDemoReplayPreset(
    typeof resolvedSearchParams?.preset === "string"
      ? resolvedSearchParams.preset
      : null
  );

  try {
    const { session, messages } = await buildApi.getSession(id);

    if (!session.is_demo) {
      redirect(
        `/build/${id}${
          requestedRepoName
            ? `?${new URLSearchParams({ e2e_repo_name: requestedRepoName }).toString()}`
            : ""
        }`
      );
    }

    return (
      <DemoSession
        initialEvents={messages}
        initialSession={session}
        replayPreset={replayPreset}
        requestedRepoName={requestedRepoName}
      />
    );
  } catch {
    return <p>Demo session not found.</p>;
  }
}
