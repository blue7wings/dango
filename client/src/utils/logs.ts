import { AgentSource, LogCategory, LogEntry } from "../shared/protocol";

type LegacyLogEntry = LogEntry & {
  agent?: AgentSource;
  hook?: string;
};

export interface LogPresentation {
  category: LogCategory;
  event: string;
  source: AgentSource;
}

const eventLabels: Record<string, string> = {
  command_send: "Command sent",
  connected: "Connected",
  connection: "Connection",
  desktop_unavailable: "Desktop unavailable",
  idle_timeout_sync: "Idle timeout sync",
  manual_command: "Manual command",
  schedule_sync: "Schedule sync"
};

export function formatLogCategory(category: LogCategory): string {
  return category === "ble" ? "BLE" : category.charAt(0).toUpperCase() + category.slice(1);
}

export function formatLogEvent(event: string): string {
  return eventLabels[event] ?? event.replace(/_/g, " ");
}

export function formatLogDetail(detail: string): string {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
}

export function getLogPresentation(log: LogEntry): LogPresentation {
  const legacy = log as LegacyLogEntry;
  const legacyEvent = legacy.hook;
  const category = log.category ?? (legacyEvent === "ble" ? "ble" : legacyEvent === "system" ? "system" : "hook");

  return {
    category,
    event: log.event ?? (legacyEvent === "ble" || legacyEvent === "system" ? "activity" : legacyEvent) ?? "unknown",
    source: log.source ?? legacy.agent ?? "unknown"
  };
}
