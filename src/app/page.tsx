import Link from 'next/link';
import { getPipelineData } from '@/data';

const VIEW_CARDS = [
  {
    href: '/simulator',
    title: 'Simulator',
    description: 'Explore how the pipeline works',
  },
  {
    href: '/replay',
    title: 'Replay',
    description: 'Watch the Code Snippet Manager run',
  },
  {
    href: '/forensics',
    title: 'Forensics',
    description: 'Inspect agent decisions and reviews',
  },
];

export default async function Home() {
  const data = await getPipelineData();
  const featuresShipped = data.issues.filter(
    (i) => i.state === 'closed' && i.labels.some((l) => l.name === 'feature')
  ).length;
  const prsMerged = data.pullRequests.filter((pr) => pr.state === 'merged').length;

  return (
    <div className="flex flex-col items-center px-6 py-20">
      {/* Hero */}
      <section className="text-center mb-16 bg-gradient-to-b from-gray-900 to-gray-950 w-full max-w-3xl rounded-2xl py-16 px-8">
        <h1 className="text-4xl font-bold mb-4 text-white">Pipeline Observatory</h1>
        <p className="text-gray-400 text-lg">
          Visualize, replay, and inspect an autonomous AI development pipeline
        </p>
      </section>

      {/* View Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-16">
        {VIEW_CARDS.map(({ href, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl bg-gray-900 border border-gray-800 p-8 flex flex-col gap-2 hover:bg-gray-800 transition-colors"
          >
            <span className="text-xl font-semibold text-white">{title}</span>
            <span className="text-gray-400 text-sm">{description}</span>
          </Link>
        ))}
      </section>

      {/* Stats Bar */}
      <section className="flex flex-wrap gap-8 justify-center text-center">
        <div>
          <span className="text-2xl font-bold text-white">{featuresShipped}</span>
          <p className="text-gray-400 text-sm">features shipped</p>
        </div>
        <div>
          <span className="text-2xl font-bold text-white">{prsMerged}</span>
          <p className="text-gray-400 text-sm">PRs merged</p>
        </div>
        <div>
          <span className="text-2xl font-bold text-white">~2 hours</span>
          <p className="text-gray-400 text-sm">end-to-end</p>
        </div>
      </section>
    </div>
  );
}
