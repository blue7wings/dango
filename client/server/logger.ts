import pino from "pino";
import { AgentEvent, AgentSource, Face, Indicator, LogEntry } from "../src/shared/protocol.js";

export class LogService {
  private readonly logger = pino({ name: "dango" });
  private readonly entries: LogEntry[] = [];

  all(): LogEntry[] {
    return [...this.entries];
  }

  add(input: {
    agent: AgentSource;
    hook: AgentEvent | "ble" | "system";
    expression?: Face;
    indicator?: Indicator;
    result: "success" | "error" | "info";
    detail: string;
  }): LogEntry {
    const now = new Date();
    const entry: LogEntry = {
      id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
      time: now.toLocaleTimeString(),
      timestamp: now.getTime(),
      ...input
    };

    this.entries.unshift(entry);
    this.entries.splice(250);

    const log = input.result === "error" ? this.logger.error.bind(this.logger) : this.logger.info.bind(this.logger);
    log({ agent: input.agent, hook: input.hook, expression: input.expression, indicator: input.indicator }, input.detail);
    return entry;
  }
}
