/**
 * Multi-Agent System
 *
 * Exports for the multi-agent conversation and analysis system.
 */

// Agents
export { AudioAgent } from "./audio-agent";
export { VisionAgent } from "./vision-agent";
export { AgentCoordinator, getAgentCoordinator } from "./coordinator";

// Database
export {
  ConversationDatabase,
  getConversationDatabase,
} from "./conversation-db";

// Prompts
export {
  AUDIO_AGENT_SYSTEM_PROMPT,
  AUDIO_AGENT_ANALYSIS_PROMPT,
  VISION_AGENT_SYSTEM_PROMPT,
  VISION_AGENT_ANALYSIS_PROMPT,
  COORDINATOR_CONSENSUS_PROMPT,
} from "./prompts";

// Types
export type {
  AgentId,
  AgentRole,
  AgentMessage,
  ConversationContext,
  AgentAnalysis,
  ConversationConclusion,
  IncidentInput,
  YoloDetection,
  AgentInterface,
} from "./types";
