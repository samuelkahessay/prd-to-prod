import { getPipelineData } from "@/data/index";
import { Timeline } from "@/components/replay/timeline";

export default async function ReplayPage() {
  const data = await getPipelineData();

  return (
    <main className="min-h-screen bg-gray-950 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Pipeline Replay</h1>
        <p className="text-gray-400 mb-10">
          Watch the Code Snippet Manager pipeline run unfold in real time on the event timeline.
        </p>
        <Timeline data={data} />
      </div>
    </main>
  );
}
