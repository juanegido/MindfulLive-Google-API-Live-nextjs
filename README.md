# MindfulLive

MindfulLive is a voice-first wellness app built with Next.js and Google's Gemini Live API. The current default experience uses a three-phase wellness flow:

1. **Plan**: Gemini proposes a meditation, breathing, or focus session.
2. **Execute**: the approved activity runs with a live visual widget and local timer.
3. **Analysis**: the app renders session insights, progress stats, and a next-session recommendation.

The legacy meditation-only interface is still available at `?wellness=v1`.

## Features

- **Voice-first Gemini Live guidance** using `gemini-3.1-flash-live-preview` and the Aoede voice.
- **Plan approval flow** with an on-screen approval card for accepting, revising, or declining a proposed session.
- **Three wellness activities**:
  - meditation with a circular countdown
  - breathing with the existing breathing visualizer and audio breathing analyzer
  - focus with lazy MediaPipe pose tracking
- **Analysis widgets** for summary, progress, and next-session recommendations.
- **Persistent progress** using SSR-safe `localStorage` hydration.
- **Legacy fallback** at `/ ?wellness=v1` for the previous guided meditation UI.

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file with your Gemini API key:

```bash
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
```

Run the development server:

```bash
npm run dev
```

Open the app:

- v2 default: [http://localhost:3000](http://localhost:3000)
- legacy v1: [http://localhost:3000/?wellness=v1](http://localhost:3000/?wellness=v1)

If port 3000 is already occupied, Next.js will choose the next available port.

## Verification

Run a production build before shipping changes:

```bash
npm run build
```

Manual smoke test:

1. Open the v2 default route.
2. Click connect and grant microphone permissions.
3. Ask for a meditation, breathing, or focus session.
4. Confirm that a plan card appears.
5. Accept the plan by clicking the card or saying yes.
6. Confirm the activity widget runs and then transitions to analysis.
7. Reload and confirm progress stats persist.

## Project Structure

- `src/app/page.tsx`: Route entry. Defaults to v2 and keeps legacy behind `?wellness=v1`.
- `src/components/wellness-shell.tsx`: Main v2 shell for camera/audio controls and phase rendering.
- `src/components/wellness-live-bridge.tsx`: Gemini Live tool-call bridge into the wellness reducer.
- `src/context/wellness-context.tsx`: Reducer, provider, activity state, analysis widgets, and history hydration.
- `src/lib/tool-declarations/`: Plan, execute, and analysis tool declarations for Gemini Live.
- `src/lib/system-instruction.ts`: Voice-first system prompt and UI contract guidance.
- `src/lib/a2ui/wellness-ui-contract.ts`: A2UI-shaped surface contract used by the prompt and widgets.
- `src/lib/wellness-storage.ts`: localStorage persistence and progress stat calculation.
- `src/components/phases/`: Plan, execute, and analysis phase renderers.
- `src/components/activities/`: Meditation, breathing, and focus activity widgets.
- `src/components/widgets/`: Plan approval and analysis widgets.
- `src/components/meditation/MeditationGuide.tsx`: Legacy v1 guided meditation experience.
- `src/components/control-tray/ControlTray.tsx`: Shared microphone, camera, screen, and connection controls.

## AI Tool Flow

The v2 Gemini tool vocabulary is split by phase:

- Plan: `propose_wellness_plan`, `revise_wellness_plan`, `cancel_plan_proposal`, `confirm_wellness_plan`
- Execute: `start_wellness_activity`, `update_activity_widget`, `complete_wellness_activity`, `cancel_wellness_activity`
- Analysis: `emit_analysis_summary`, `emit_streak_update`, `emit_next_recommendation`

Tool calls are handled in `src/components/wellness-live-bridge.tsx`, which validates basic argument shape, dispatches reducer actions, and immediately returns tool responses to Gemini Live.

## CopilotKit Runtime

The v2 app mounts CopilotKit as a required rendering/runtime layer:

- `src/components/copilot-shell.tsx` wraps the v2 experience with `<CopilotKit>`, `createA2UIMessageRenderer`, and `viewerTheme`.
- `src/app/api/copilotkit/[[...slug]]/route.ts` exposes the CopilotKit runtime endpoint with a minimal puppet `BuiltInAgent`.
- `src/components/wellness-copilot-bridge.tsx` registers wellness frontend tools and the HITL plan approval tool with CopilotKit.
- `src/components/wellness-live-bridge.tsx` keeps Gemini Live as the conversational brain and mirrors Gemini tool calls through `copilotkit.runTool({ followUp: false })`.

This means Gemini Live drives the conversation, while CopilotKit provides the tool runtime, HITL registration, and A2UI-compatible rendering layer.
