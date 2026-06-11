import { EventEmitter } from "node:events";
import {
  AgentEvent,
  AgentMessage,
  AgentSource,
  AppSnapshot,
  BleStatus,
  CompanionConfig,
  DeviceCommand,
  DeviceSnapshot,
  resolveCommand
} from "../src/shared/protocol.js";
import { ConfigService } from "./config.js";
import { LogService } from "./logger.js";

export class AppState extends EventEmitter {
  currentEvent: AgentEvent = "stop";
  currentCommand: DeviceCommand = { face: "idle", indicator: "off", display: "on" };
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
    const command = resolveCommand(event);
    this.currentEvent = event;
    this.currentCommand = command;

    const message: AgentMessage = {
      event,
      command,
      source,
      timestamp: Date.now()
    };

    this.logs.add({
      source,
      category: "hook",
      event,
      expression: command.face,
      indicator: command.indicator,
      result: "success",
      detail: `${event} → ${command.face} / ${command.indicator}`
    });
    this.emit("agent-message", message);
    this.emit("changed", this.snapshot());
    return message;
  }

  sendCommand(command: DeviceCommand, source: AgentSource = "desktop"): AgentMessage {
    this.currentCommand = command;
    const message: AgentMessage = {
      event: this.currentEvent,
      command,
      source,
      timestamp: Date.now()
    };
    this.logs.add({
      source,
      category: "system",
      event: "manual_command",
      expression: command.face,
      indicator: command.indicator,
      result: "info",
      detail: `Manual: ${command.face} / ${command.indicator} / ${command.display}`
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
      currentCommand: this.currentCommand,
      ble: {
        status: this.bleStatus,
        device: this.device,
        lastError: this.lastBleError
      },
      logs: this.logs.all()
    };
  }
}
