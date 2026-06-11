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

function minuteOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function isScheduledDisplayOff(config: CompanionConfig, now: Date): boolean {
  if (!config.displayScheduleEnabled) return false;
  const offMinute = minuteOfDay(config.displayOffTime);
  const onMinute = minuteOfDay(config.displayOnTime);
  if (offMinute === null || onMinute === null || offMinute === onMinute) return false;

  const currentMinute = now.getHours() * 60 + now.getMinutes();
  if (offMinute < onMinute) {
    return currentMinute >= offMinute && currentMinute < onMinute;
  }
  return currentMinute >= offMinute || currentMinute < onMinute;
}

function commandsEqual(left: DeviceCommand, right: DeviceCommand): boolean {
  return left.face === right.face && left.indicator === right.indicator && left.display === right.display;
}

export class AppState extends EventEmitter {
  currentEvent: AgentEvent = "stop";
  currentCommand: DeviceCommand = { face: "idle", indicator: "off", display: "on" };
  bleStatus: BleStatus = "idle";
  device: DeviceSnapshot | null = null;
  lastBleError: string | null = null;
  private baseCommand: DeviceCommand = { ...this.currentCommand };
  private lastCommandAt = Date.now();
  private readonly stateTimer: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly logs: LogService
  ) {
    super();
    this.applyTimedState(Date.now(), false);
    this.stateTimer = setInterval(() => this.applyTimedState(), 1000);
    this.stateTimer.unref();
  }

  handleAgentEvent(event: AgentEvent, source: AgentSource): AgentMessage {
    const command = resolveCommand(event);
    this.currentEvent = event;
    this.baseCommand = command;
    this.lastCommandAt = Date.now();
    this.applyTimedState(this.lastCommandAt, false);

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
    this.baseCommand = command;
    this.lastCommandAt = Date.now();
    this.applyTimedState(this.lastCommandAt, false);
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
    if (patch.idleTimeoutMinutes !== undefined) this.lastCommandAt = Date.now();
    this.applyTimedState(Date.now(), false);
    this.emit("changed", this.snapshot());
    return config;
  }

  dispose(): void {
    clearInterval(this.stateTimer);
  }

  commandDefaults(): DeviceCommand {
    return { ...this.baseCommand };
  }

  private applyTimedState(timestamp = Date.now(), emitChange = true): void {
    const config = this.configService.get();
    const idleTimeoutMs = config.idleTimeoutMinutes * 60_000;

    if (
      idleTimeoutMs > 0 &&
      this.baseCommand.face !== "idle" &&
      timestamp - this.lastCommandAt >= idleTimeoutMs
    ) {
      this.baseCommand = { ...this.baseCommand, face: "idle", indicator: "off" };
      this.currentEvent = "stop";
    }

    const nextCommand: DeviceCommand = {
      ...this.baseCommand,
      display: isScheduledDisplayOff(config, new Date(timestamp)) ? "off" : this.baseCommand.display
    };
    if (commandsEqual(nextCommand, this.currentCommand)) return;

    this.currentCommand = nextCommand;
    if (emitChange) this.emit("changed", this.snapshot());
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
