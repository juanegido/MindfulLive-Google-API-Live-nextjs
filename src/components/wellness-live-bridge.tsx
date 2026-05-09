"use client";

import { useEffect } from "react";
import { LiveServerToolCall, Modality } from "@google/genai";
import { useCopilotKit } from "@copilotkit/react-core/v2";
import { useLiveAPIContext } from "@/contexts/LiveAPIContext";
import { useWellness } from "@/context/wellness-context";
import { WELLNESS_SYSTEM_INSTRUCTION } from "@/lib/system-instruction";
import { wellnessToolDeclarations } from "@/lib/tool-declarations";
import { getProgressStats } from "@/lib/wellness-storage";
import type { PlanProposal, WellnessActivityType } from "@/types";

export function WellnessLiveBridge() {
  const { client, setConfig, setModel } = useLiveAPIContext();
  const { state, dispatch } = useWellness();
  const { copilotkit } = useCopilotKit();

  useEffect(() => {
    setModel("gemini-3.1-flash-live-preview");
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
      systemInstruction: {
        parts: [{ text: WELLNESS_SYSTEM_INSTRUCTION }],
      },
      tools: [{ functionDeclarations: wellnessToolDeclarations }],
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) return;

      const responses = toolCall.functionCalls.map((fc) => {
        try {
          return {
            id: fc.id,
            name: fc.name,
            response: {
              output: handleToolCall(fc.name ?? "", fc.args ?? {}),
            },
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown tool error";
          dispatch({ type: "SET_ERROR", code: fc.name ?? "tool", message });
          return {
            id: fc.id,
            name: fc.name,
            response: { output: { status: "error", message } },
          };
        }
      });

      client.sendToolResponse({ functionResponses: responses });
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, copilotkit, dispatch, state.pendingProposal, state.sessionHistory]);

  return null;

  function handleToolCall(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "propose_wellness_plan": {
        const proposal = parseProposal(args);
        dispatch({ type: "SET_PENDING_PROPOSAL", proposal });
        runCopilotTool("render_plan_approval", proposal);
        runCopilotTool("approve_wellness_plan", proposal);
        return { status: "awaiting_user_input", proposalId: proposal.id };
      }

      case "revise_wellness_plan": {
        const proposal = parseProposal({
          ...state.pendingProposal,
          ...args,
          id: args.proposalId ?? state.pendingProposal?.id,
        });
        dispatch({ type: "SET_PENDING_PROPOSAL", proposal });
        runCopilotTool("render_plan_approval", proposal);
        runCopilotTool("approve_wellness_plan", proposal);
        return { status: "awaiting_user_input", proposalId: proposal.id };
      }

      case "cancel_plan_proposal": {
        const proposalId = stringArg(args, "proposalId");
        dispatch({ type: "REJECT_PROPOSAL", proposalId });
        return { status: "ok", proposalId };
      }

      case "confirm_wellness_plan": {
        const proposalId = stringArg(args, "proposalId");
        const approved = booleanArg(args, "approved");
        dispatch({
          type: approved ? "APPLY_PROPOSAL" : "REJECT_PROPOSAL",
          proposalId,
        });
        if (approved && state.pendingProposal) {
          dispatch({
            type: "START_ACTIVITY",
            activityType: state.pendingProposal.activityType,
            durationSeconds: state.pendingProposal.durationSeconds,
          });
        }
        return { status: "ok", proposalId, approved };
      }

      case "start_wellness_activity": {
        const activityType = activityArg(args, "activityType");
        const durationSeconds = numberArg(args, "durationSeconds");
        dispatch({ type: "START_ACTIVITY", activityType, durationSeconds });
        runCopilotTool("render_activity_start", {
          activityType,
          durationSeconds,
        });
        return { status: "ok" };
      }

      case "update_activity_widget": {
        runCopilotTool("render_activity_update", args);
        dispatch({
          type: "UPDATE_ACTIVITY",
          patch: {
            phase: stringArg(args, "currentPhase"),
            timerSeconds:
              typeof args.timerSeconds === "number"
                ? args.timerSeconds
                : undefined,
            guidance:
              typeof args.guidance === "string" ? args.guidance : undefined,
            encouragement:
              typeof args.encouragement === "string"
                ? args.encouragement
                : undefined,
          },
        });
        return { status: "ok" };
      }

      case "complete_wellness_activity": {
        runCopilotTool("render_activity_complete", args);
        dispatch({
          type: "COMPLETE_ACTIVITY",
          completionQuality: stringArg(args, "completionQuality"),
          notes: typeof args.notes === "string" ? args.notes : undefined,
        });
        return { status: "ok" };
      }

      case "cancel_wellness_activity": {
        runCopilotTool("render_activity_cancel", args);
        dispatch({ type: "CANCEL_ACTIVITY", reason: stringArg(args, "reason") });
        return { status: "ok" };
      }

      case "emit_analysis_summary": {
        runCopilotTool("render_analysis_summary", args);
        dispatch({
          type: "UPSERT_ANALYSIS_WIDGET",
          widget: {
            surfaceId: "wellness-analysis-summary",
            data: {
              activityType: activityArg(args, "activityType"),
              completionQuality: stringArg(args, "completionQuality"),
              mood: stringArg(args, "mood"),
              insights: stringArrayArg(args, "insights"),
              suggestions: optionalStringArrayArg(args, "suggestions"),
            },
          },
        });
        return { status: "ok" };
      }

      case "emit_streak_update": {
        const stats = getProgressStats(state.sessionHistory);
        dispatch({
          type: "UPSERT_ANALYSIS_WIDGET",
          widget: {
            surfaceId: "wellness-analysis-progress",
            data: {
              streakDays: stats.streakDays,
              totalSessions: stats.totalSessions,
              completionRate: stats.completionRate,
              totalMinutes: stats.totalMinutes,
            },
          },
        });
        return { status: "ok", stats };
      }

      case "emit_next_recommendation": {
        runCopilotTool("render_next_recommendation", args);
        dispatch({
          type: "UPSERT_ANALYSIS_WIDGET",
          widget: {
            surfaceId: "wellness-analysis-recommendation",
            data: {
              recommendedActivity: activityArg(args, "recommendedActivity"),
              reasoning: stringArg(args, "reasoning"),
              estimatedMinutes: numberArg(args, "estimatedMinutes"),
            },
          },
        });
        return { status: "ok" };
      }

      default:
        return { status: "ignored", name };
    }
  }

  function runCopilotTool(name: string, parameters: Record<string, unknown>) {
    void copilotkit
      .runTool({
        name,
        parameters,
        followUp: false,
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "CopilotKit tool failed";
        dispatch({ type: "SET_ERROR", code: name, message });
      });
  }
}

function parseProposal(args: Record<string, unknown>): PlanProposal {
  return {
    id: typeof args.id === "string" ? args.id : `proposal-${Date.now()}`,
    activityType: activityArg(args, "activityType"),
    durationSeconds: numberArg(args, "durationSeconds"),
    intensity: intensityArg(args, "intensity"),
    focusAreas: stringArrayArg(args, "focusAreas"),
    reasoning: stringArg(args, "reasoning"),
    createdAt: typeof args.createdAt === "number" ? args.createdAt : Date.now(),
  };
}

function activityArg(
  args: Record<string, unknown>,
  key: string
): WellnessActivityType {
  const value = args[key];
  if (value === "meditation" || value === "breathing" || value === "focus") {
    return value;
  }
  throw new Error(`${key} must be meditation, breathing, or focus`);
}

function intensityArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (value === "low" || value === "medium" || value === "high") return value;
  throw new Error(`${key} must be low, medium, or high`);
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value === "string") return value;
  throw new Error(`${key} must be a string`);
}

function numberArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${key} must be a number`);
}

function booleanArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value === "boolean") return value;
  throw new Error(`${key} must be a boolean`);
}

function stringArrayArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error(`${key} must be a string array`);
}

function optionalStringArrayArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value === "undefined") return [];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error(`${key} must be a string array`);
}
