import { SHOWCASE_APPS } from "@/lib/showcase-data";
import ShowcaseAppClient from "./page-client";

export function generateStaticParams() {
  return SHOWCASE_APPS.map((app) => ({ slug: app.slug }));
}

export default async function ShowcaseAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ShowcaseAppClient slug={slug} />;
}
