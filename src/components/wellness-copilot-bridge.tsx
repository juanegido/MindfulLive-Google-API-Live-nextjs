"use client";

import { z } from "zod/v4";
import {
  type JsonSerializable,
  useAgentContext,
  useFrontendTool,
  useHumanInTheLoop,
} from "@copilotkit/react-core/v2";
import { useWellness } from "@/context/wellness-context";
import { PlanApprovalCard } from "@/components/widgets/plan-approval-card";
import type { PlanProposal, WellnessActivityType } from "@/types";

const activitySchema = z.enum(["meditation", "breathing", "focus"]);
const intensitySchema = z.enum(["low", "medium", "high"]);

const proposalSchema = z.object({
  id: z.string().optional(),
  activityType: activitySchema,
  durationSeconds: z.number().min(1).max(7200),
  intensity: intensitySchema,
  focusAreas: z.array(z.string()).default([]),
  reasoning: z.string(),
  createdAt: z.number().optional(),
});

const updateActivitySchema = z.object({
  currentPhase: z.string(),
  timerSeconds: z.number().min(0).optional(),
  guidance: z.string().optional(),
  encouragement: z.string().optional(),
});

const startActivitySchema = z.object({
  activityType: activitySchema,
  durationSeconds: z.number().min(1).max(7200),
});

const completeActivitySchema = z.object({
  completionQuality: z.string(),
  notes: z.string().optional(),
});

const cancelActivitySchema = z.object({
  reason: z.string(),
});

const analysisSummarySchema = z.object({
  activityType: activitySchema,
  completionQuality: z.string(),
  mood: z.string(),
  insights: z.array(z.string()),
  suggestions: z.array(z.string()).optional(),
});

const nextRecommendationSchema = z.object({
  recommendedActivity: activitySchema,
  reasoning: z.string(),
  estimatedMinutes: z.number().min(1).max(180),
});

export function WellnessCopilotBridge() {
  const { state, dispatch, approveProposal, rejectProposal } = useWellness();

  useAgentContext({
    description:
      "MindfulLive wellness state shared with CopilotKit frontend tools. Gemini Live remains the conversational brain; CopilotKit renders and executes visual/UI tool surfaces.",
    value: JSON.parse(JSON.stringify(state)) as JsonSerializable,
  });

  useHumanInTheLoop(
    {
      name: "approve_wellness_plan",
      description:
        "Render a human approval card for a Gemini Live wellness plan proposal.",
      parameters: proposalSchema,
      render: ({ args, status, respond }) => {
        if (status === "complete") {
          return (
            <div className="rounded-2xl border border-white/25 bg-white/20 p-4 text-white backdrop-blur-xl">
              Plan decision recorded.
            </div>
          );
        }

        if (status === "inProgress") {
          return (
            <div className="rounded-2xl border border-white/25 bg-white/20 p-4 text-white backdrop-blur-xl">
              Preparing plan approval...
            </div>
          );
        }

        const proposal = materializeProposal(args);

        const approve = async () => {
          approveProposal(proposal.id);
          dispatch({
            type: "START_ACTIVITY",
            activityType: proposal.activityType,
            durationSeconds: proposal.durationSeconds,
          });
          await respond?.({ approved: true, proposalId: proposal.id });
        };

        const reject = async () => {
          rejectProposal(proposal.id);
          await respond?.({ approved: false, proposalId: proposal.id });
        };

        const revise = async () => {
          await respond?.({
            approved: false,
            revise: true,
            proposalId: proposal.id,
          });
        };

        return (
          <PlanApprovalCard
            proposal={proposal}
            onApprove={() => void approve()}
            onReject={() => void reject()}
            onRevise={() => void revise()}
          />
        );
      },
    },
    [approveProposal, dispatch, rejectProposal]
  );

  useFrontendTool(
    {
      name: "render_plan_approval",
      description:
        "Mirror a Gemini Live plan proposal into MindfulLive state for the visible approval card.",
      parameters: proposalSchema,
      handler: async (args) => {
        const proposal = materializeProposal(args);
        dispatch({ type: "SET_PENDING_PROPOSAL", proposal });
        return { status: "awaiting_user_input", proposalId: proposal.id };
      },
      followUp: false,
    },
    [dispatch]
  );

  useFrontendTool(
    {
      name: "render_activity_start",
      description: "Start the selected wellness activity UI.",
      parameters: startActivitySchema,
      handler: async ({ activityType, durationSeconds }) => {
        dispatch({ type: "START_ACTIVITY", activityType, durationSeconds });
        return { status: "ok" };
      },
      followUp: false,
    },
    [dispatch]
  );

  useFrontendTool(
    {
      name: "render_activity_update",
      description: "Update the active wellness activity UI.",
      parameters: updateActivitySchema,
      handler: async (args) => {
        dispatch({
          type: "UPDATE_ACTIVITY",
          patch: {
            phase: args.currentPhase,
            timerSeconds: args.timerSeconds,
            guidance: args.guidance,
            encouragement: args.encouragement,
          },
        });
        return { status: "ok" };
      },
      followUp: false,
    },
    [dispatch]
  );

  useFrontendTool(
    {
      name: "render_activity_complete",
      description: "Complete the current wellness activity UI.",
      parameters: completeActivitySchema,
      handler: async ({ completionQuality, notes }) => {
        dispatch({ type: "COMPLETE_ACTIVITY", completionQuality, notes });
        return { status: "ok" };
      },
      followUp: false,
    },
    [dispatch]
  );

  useFrontendTool(
    {
      name: "render_activity_cancel",
      description: "Cancel the current wellness activity UI.",
      parameters: cancelActivitySchema,
      handler: async ({ reason }) => {
        dispatch({ type: "CANCEL_ACTIVITY", reason });
        return { status: "ok" };
      },
      followUp: false,
    },
    [dispatch]
  );

  useFrontendTool(
    {
      name: "render_analysis_summary",
      description: "Render the wellness analysis summary surface.",
      parameters: analysisSummarySchema,
      handler: async (args) => {
        dispatch({
          type: "UPSERT_ANALYSIS_WIDGET",
          widget: {
            surfaceId: "wellness-analysis-summary",
            data: {
              activityType: args.activityType,
              completionQuality: args.completionQuality,
              mood: args.mood,
              insights: args.insights,
              suggestions: args.suggestions ?? [],
            },
          },
        });
        return { status: "ok" };
      },
      followUp: false,
    },
    [dispatch]
  );

  useFrontendTool(
    {
      name: "render_next_recommendation",
      description: "Render the next wellness recommendation surface.",
      parameters: nextRecommendationSchema,
      handler: async (args) => {
        dispatch({
          type: "UPSERT_ANALYSIS_WIDGET",
          widget: {
            surfaceId: "wellness-analysis-recommendation",
            data: {
              recommendedActivity: args.recommendedActivity,
              reasoning: args.reasoning,
              estimatedMinutes: args.estimatedMinutes,
            },
          },
        });
        return { status: "ok" };
      },
      followUp: false,
    },
    [dispatch]
  );

  return null;
}

function materializeProposal(
  args: z.infer<typeof proposalSchema>
): PlanProposal {
  const createdAt = args.createdAt ?? Date.now();

  return {
    id: args.id ?? `proposal-${createdAt}`,
    activityType: args.activityType as WellnessActivityType,
    durationSeconds: args.durationSeconds,
    intensity: args.intensity,
    focusAreas: args.focusAreas,
    reasoning: args.reasoning,
    createdAt,
  };
}
