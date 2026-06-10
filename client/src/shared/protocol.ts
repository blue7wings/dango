export type Expression =
  | "idle"
  | "working"
  | "tool_call_start"
  | "tool_call_end"
  | "error";

export type AgentEvent =
  | "session_start"
  | "user_prompt_submit"
  | "ai_running"
  | "tool_call_start"
  | "tool_call_end"
  | "tool_use"
  | "tool_done"
  | "permission_request"
  | "error"
  | "stop";

export type AgentSource = "codex" | "cursor" | "claude-code" | "kiro" | string;

export type BleStatus = "idle" | "scanning" | "connected" | "disconnected" | "error";

export interface CompanionConfig {
  webhookPort: number;
  autoConnect: boolean;
  deviceName: string;
  serviceUUID: string;
  characteristicUUID: string;
  displayScheduleEnabled: boolean;
  displayOffTime: string;
  displayOnTime: string;
}

export interface AgentMessage {
  event: AgentEvent;
  expression: Expression;
  source: AgentSource;
  timestamp: number;
}

export interface LogEntry {
  id: string;
  time: string;
  timestamp: number;
  agent: AgentSource;
  hook: AgentEvent | "ble" | "system";
  expression?: Expression;
  result: "success" | "error" | "info";
  detail: string;
}

export interface DeviceSnapshot {
  name: string;
  id: string;
  rssi: number | null;
}

export interface AppSnapshot {
  config: CompanionConfig;
  currentEvent: AgentEvent;
  currentExpression: Expression;
  ble: {
    status: BleStatus;
    device: DeviceSnapshot | null;
    lastError: string | null;
  };
  logs: LogEntry[];
}

export type HookAgentId = "codex" | "kiro";

export interface HookTarget {
  id: string;
  name: string;
  path: string;
  installed: number;
  total: number;
  writable: boolean;
  error?: string;
}

export interface HookAgentConfig {
  id: HookAgentId;
  name: string;
  description: string;
  path: string;
  targets: HookTarget[];
}

export interface HookInstallRequest {
  agent: HookAgentId;
  targetIds?: string[];
}

export interface HookInstallResult {
  success: boolean;
  changedFiles: number;
  addedHooks: number;
  errors: string[];
  agents: HookAgentConfig[];
}

export const DEFAULT_SERVICE_UUID = "7b8f9a10-2f43-4a6f-8b1e-6f4d3c2b1a90";
export const DEFAULT_CHARACTERISTIC_UUID = "7b8f9a11-2f43-4a6f-8b1e-6f4d3c2b1a90";

export const EXPRESSIONS: Record<Expression, string> = {
  idle: "| |",
  working: "| |",
  tool_call_start: "| |",
  tool_call_end: "| |",
  error: "| |"
};

export const EVENT_MAP: Record<AgentEvent, Expression> = {
  session_start: "idle",
  user_prompt_submit: "working",
  ai_running: "working",
  tool_call_start: "tool_call_start",
  tool_call_end: "tool_call_end",
  tool_use: "tool_call_start",
  tool_done: "tool_call_end",
  permission_request: "error",
  error: "error",
  stop: "idle"
};

const PRIORITY: Record<Expression, number> = {
  error: 60,
  tool_call_start: 45,
  working: 40,
  tool_call_end: 35,
  idle: 0
};

export function isAgentEvent(value: unknown): value is AgentEvent {
  return typeof value === "string" && value in EVENT_MAP;
}

export function resolveExpression(event: AgentEvent, current: Expression): Expression {
  const next = EVENT_MAP[event];

  if (event === "stop") return "idle";
  if (event === "session_start") return "idle";
  if (event === "error") return "error";
  if (event === "permission_request") return "error";

  // Error stays active until an explicit stop or new session resets it.
  if (current === "error") return current;

  if (event === "tool_call_end" || event === "tool_done") return "tool_call_end";
  return PRIORITY[next] >= PRIORITY[current] ? next : current;
}

export function createBlePayload(message: AgentMessage): string {
  return JSON.stringify(message);
}

export function createDisplaySchedulePayload(config: CompanionConfig): string {
  return JSON.stringify({
    type: "display_schedule",
    enabled: config.displayScheduleEnabled,
    off: config.displayOffTime,
    on: config.displayOnTime,
    timestamp: Date.now(),
    timezoneOffset: -new Date().getTimezoneOffset()
  });
}
