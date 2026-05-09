"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LiveAPIProvider } from "../contexts/LiveAPIContext";
import { LiveClientOptions } from "../types";
import MeditationGuide from "../components/meditation/MeditationGuide";
import { CopilotShell } from "@/components/copilot-shell";
import { WellnessShell } from "@/components/wellness-shell";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";

const apiOptions: LiveClientOptions = {
  apiKey: API_KEY,
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const useLegacy = searchParams.get("wellness") === "v1";

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#38bdf8]/70 via-[#22d3ee]/60 to-[#4ade80]/70 z-0 pointer-events-none opacity-70" />
      <div className="relative z-10">
        <LiveAPIProvider options={apiOptions}>
          {useLegacy ? (
            <div className="flex min-h-screen items-center justify-center">
              <MeditationGuide />
            </div>
          ) : (
            <CopilotShell>
              <WellnessShell />
            </CopilotShell>
          )}
        </LiveAPIProvider>
      </div>
    </div>
  );
}
