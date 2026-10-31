"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export type UrlTab = {
  value: string;
  label: string;
  icon: React.ReactNode;
  // already-rendered content (a server component tree can be passed in)
  content: React.ReactNode;
};

// Tabs whose selection also lives in the address (?tab=...), so a link opens
// on that tab and a refresh or a server action keeps the place. The URL is
// updated in place (no navigation, no server round-trip).
export function UrlTabs({
  tabs,
  initial,
  param = "tab",
}: {
  tabs: UrlTab[];
  initial: string;
  param?: string;
}) {
  const [value, setValue] = useState(
    tabs.some((t) => t.value === initial) ? initial : tabs[0].value,
  );

  function change(next: unknown) {
    const tab = String(next);
    setValue(tab);
    const url = new URL(window.location.href);
    url.searchParams.set(param, tab);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={value} onValueChange={change}>
      <TabsList aria-label="Secciones del cliente">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
