/**
 * MiniMax API Client
 *
 * Unified exports for MiniMax API integrations.
 */

export {
  MiniMaxClient,
  getMiniMaxClient,
  isMiniMaxConfigured,
  resetMiniMaxClient,
  MINIMAX_MODELS,
  MINIMAX_ENDPOINTS,
} from "./client";

export type {
  MiniMaxConfig,
  ChatMessage,
  MessageContent,
  ChatCompletionRequest,
  ChatCompletionResponse,
  SpeechToTextResponse,
} from "./client";
