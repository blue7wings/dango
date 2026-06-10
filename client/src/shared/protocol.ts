export type Face = "idle" | "focused";

export type Indicator =
  | "off"
  | "green_solid"
  | "green_breathe"
  | "yellow_solid"
  | "yellow_breathe"
  | "red_solid"
  | "red_breathe";

export type DisplayPower = "on" | "off";

export type AgentEvent =
  | "session_start"
  | "user_prompt_submit"
  | "ai_running"
  | "tool_call_start"
  | "tool_call_end"
  | "tool_use"
  | "tool_done"
  | "success"
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
  idleTimeoutMinutes: number;
}

export interface DeviceCommand {
  face: Face;
  indicator: Indicator;
  display: DisplayPower;
}

export interface AgentMessage {
  event: AgentEvent;
  command: DeviceCommand;
  source: AgentSource;
  timestamp: number;
}

export interface LogEntry {
  id: string;
  time: string;
  timestamp: number;
  agent: AgentSource;
  hook: AgentEvent | "ble" | "system";
  expression?: Face;
  indicator?: Indicator;
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
  currentCommand: DeviceCommand;
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

export const FACES: Face[] = ["idle", "focused"];
export const INDICATORS: Indicator[] = ["off", "green_solid", "green_breathe", "yellow_solid", "yellow_breathe", "red_solid", "red_breathe"];
export const DISPLAY_POWERS: DisplayPower[] = ["on", "off"];

export const EVENT_COMMAND_MAP: Record<AgentEvent, Omit<DeviceCommand, "display">> = {
  session_start: { face: "focused", indicator: "green_breathe" },
  user_prompt_submit: { face: "focused", indicator: "green_breathe" },
  ai_running: { face: "focused", indicator: "green_breathe" },
  tool_call_start: { face: "focused", indicator: "yellow_breathe" },
  tool_call_end: { face: "focused", indicator: "green_breathe" },
  tool_use: { face: "focused", indicator: "yellow_breathe" },
  tool_done: { face: "focused", indicator: "green_breathe" },
  success: { face: "focused", indicator: "green_solid" },
  permission_request: { face: "focused", indicator: "red_solid" },
  error: { face: "focused", indicator: "red_solid" },
  stop: { face: "idle", indicator: "off" }
};

export function isAgentEvent(value: unknown): value is AgentEvent {
  return typeof value === "string" && value in EVENT_COMMAND_MAP;
}

export function resolveCommand(event: AgentEvent): DeviceCommand {
  return { ...EVENT_COMMAND_MAP[event], display: "on" };
}

export function createBlePayload(command: DeviceCommand): string {
  return JSON.stringify(command);
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

export function createIdleTimeoutPayload(config: CompanionConfig): string {
  return JSON.stringify({
    type: "idle_timeout",
    idleTimeoutMinutes: config.idleTimeoutMinutes
  });
}
