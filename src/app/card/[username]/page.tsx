import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDevCardData } from "@/data";
import CardView from "./card-view";

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = params;
  return {
    title: `DevCard — @${username}`,
    description: `Developer identity card for @${username}`,
    openGraph: {
      images: [`/api/og/${username}`],
    },
  };
}

export default async function CardPage({ params }: Props) {
  const { username } = params;

  let data;
  try {
    data = await getDevCardData(username);
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center gap-6">
        <CardView data={data} username={username} />
        <Link
          href="/"
          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
        >
          ← Generate Another
        </Link>
      </div>
    </main>
  );
}
