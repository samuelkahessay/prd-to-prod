"use client";

import dynamic from "next/dynamic";

const APPS: Record<string, ReturnType<typeof dynamic>> = {
  "code-snippets": dynamic(() => import("@/components/showcase/code-snippets/app")),
  "observatory": dynamic(() => import("@/components/showcase/observatory/app")),
  "devcard": dynamic(() => import("@/components/showcase/devcard/app")),
  "ticket-deflection": dynamic(() => import("@/components/showcase/ticket-deflection/app")),
  "compliance": dynamic(() => import("@/components/showcase/compliance/app")),
};

export default function ShowcaseAppClient({ slug }: { slug: string }) {
  const AppComponent = APPS[slug];
  if (!AppComponent) return <div>App not found</div>;
  return <AppComponent />;
}
