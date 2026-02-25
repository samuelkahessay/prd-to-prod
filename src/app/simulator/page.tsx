import SimulatorControls from "@/components/simulator/simulator-controls";

export default function SimulatorPage() {
  return (
    <main className="min-h-screen bg-gray-950 py-12 px-6">
      <div className="w-full max-w-screen-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Pipeline Simulator</h1>
        <p className="text-gray-400 mb-10">
          Click <span className="text-blue-400 font-medium">"PRD Decomposer"</span> to start the
          animated chain reaction, or click any node to trigger from that stage.
        </p>
        <SimulatorControls />
      </div>
    </main>
  );
}
