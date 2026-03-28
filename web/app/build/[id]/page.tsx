import { BuildStatus } from "@/components/build/build-status";
import { buildApi } from "@/lib/build-api";

export default async function BuildStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ e2e_repo_name?: string | string[] | undefined }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ||
      Promise.resolve<{ e2e_repo_name?: string | string[] | undefined }>({}),
  ]);
  const requestedRepoName =
    typeof resolvedSearchParams?.e2e_repo_name === "string"
      ? resolvedSearchParams.e2e_repo_name
      : null;

  try {
    const { session, messages } = await buildApi.getSession(id);
    return (
      <BuildStatus
        initialEvents={messages}
        initialSession={session}
        requestedRepoName={requestedRepoName}
      />
    );
  } catch {
    return <p>Build session not found.</p>;
  }
}
