"use client";

import type { ReactNode } from "react";
import {
  CopilotKit,
  createA2UIMessageRenderer,
} from "@copilotkit/react-core/v2";
import { viewerTheme } from "@copilotkit/a2ui-renderer";
import "@copilotkit/react-core/v2/styles.css";
import { WellnessProvider } from "@/context/wellness-context";
import { WellnessCopilotBridge } from "@/components/wellness-copilot-bridge";

const a2uiRenderer = createA2UIMessageRenderer({
  theme: viewerTheme,
});

export function CopilotShell({ children }: { children: ReactNode }) {
  const runtimeUrl =
    process.env.NEXT_PUBLIC_COPILOT_RUNTIME_URL ?? "/api/copilotkit";
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      useSingleEndpoint={false}
      showDevConsole={!isProduction}
      debug={
        isProduction ? false : { events: true, lifecycle: true, verbose: false }
      }
      renderActivityMessages={[a2uiRenderer]}
      a2ui={{ theme: viewerTheme }}
    >
      <WellnessProvider>
        <WellnessCopilotBridge />
        {children}
      </WellnessProvider>
    </CopilotKit>
  );
}
