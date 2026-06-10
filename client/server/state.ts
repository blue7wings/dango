import { EventEmitter } from "node:events";
import {
  AgentEvent,
  AgentMessage,
  AgentSource,
  AppSnapshot,
  BleStatus,
  CompanionConfig,
  DeviceSnapshot,
  Expression,
  resolveExpression
} from "../src/shared/protocol.js";
import { ConfigService } from "./config.js";
import { LogService } from "./logger.js";

export class AppState extends EventEmitter {
  currentEvent: AgentEvent = "stop";
  currentExpression: Expression = "idle";
  bleStatus: BleStatus = "idle";
  device: DeviceSnapshot | null = null;
  lastBleError: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logs: LogService
  ) {
    super();
  }

  handleAgentEvent(event: AgentEvent, source: AgentSource): AgentMessage {
    const expression = resolveExpression(event, this.currentExpression);
    this.currentEvent = event;
    this.currentExpression = expression;

    const message: AgentMessage = {
      event,
      expression,
      source,
      timestamp: Date.now()
    };

    this.logs.add({
      agent: source,
      hook: event,
      expression,
      result: "success",
      detail: `Mapped ${event} to ${expression}`
    });
    this.emit("agent-message", message);
    this.emit("changed", this.snapshot());
    return message;
  }

  setExpression(expression: Expression, source: AgentSource = "desktop"): AgentMessage {
    this.currentEvent = expression === "idle" ? "stop" : "ai_running";
    this.currentExpression = expression;
    const message: AgentMessage = {
      event: this.currentEvent,
      expression,
      source,
      timestamp: Date.now()
    };
    this.logs.add({
      agent: source,
      hook: "system",
      expression,
      result: "info",
      detail: `Manual expression test: ${expression}`
    });
    this.emit("agent-message", message);
    this.emit("changed", this.snapshot());
    return message;
  }

  setBle(status: BleStatus, device: DeviceSnapshot | null = this.device, error: string | null = null): void {
    this.bleStatus = status;
    this.device = device;
    this.lastBleError = error;
    this.emit("changed", this.snapshot());
  }

  updateConfig(patch: Partial<CompanionConfig>): CompanionConfig {
    const config = this.configService.update(patch);
    this.emit("changed", this.snapshot());
    return config;
  }

  snapshot(): AppSnapshot {
    return {
      config: this.configService.get(),
      currentEvent: this.currentEvent,
      currentExpression: this.currentExpression,
      ble: {
        status: this.bleStatus,
        device: this.device,
        lastError: this.lastBleError
      },
      logs: this.logs.all()
    };
  }
}
