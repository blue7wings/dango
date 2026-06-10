import { EventEmitter } from "node:events";
import {
  AgentMessage,
  CompanionConfig,
  createBlePayload,
  createDisplaySchedulePayload
} from "../src/shared/protocol.js";
import { AppState } from "./state.js";
import { LogService } from "./logger.js";

type NobleModule = typeof import("@abandonware/noble");
type NoblePeripheral = {
  id: string;
  state?: string;
  rssi?: number;
  advertisement: { localName?: string };
  once(event: "disconnect", listener: () => void): void;
  connectAsync(): Promise<void>;
  disconnectAsync(): Promise<void>;
  discoverSomeServicesAndCharacteristicsAsync(
    serviceUUIDs: string[],
    characteristicUUIDs: string[]
  ): Promise<{ characteristics: NobleCharacteristic[] }>;
};
type NobleCharacteristic = {
  writeAsync(payload: Buffer, withoutResponse: boolean): Promise<void>;
};
type NobleRuntime = NobleModule & {
  state?: string;
  startScanningAsync(serviceUUIDs: string[], allowDuplicates: boolean): Promise<void>;
  stopScanningAsync(): Promise<void>;
  on(event: "discover", listener: (peripheral: NoblePeripheral) => void): void;
  once(event: "stateChange", listener: (state: string) => void): void;
  removeListener(event: "discover", listener: (peripheral: NoblePeripheral) => void): void;
};

function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

export class BleManager extends EventEmitter {
  private noble: NobleRuntime | null = null;
  private peripheral: NoblePeripheral | null = null;
  private characteristic: NobleCharacteristic | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly state: AppState,
    private readonly logs: LogService
  ) {
    super();
  }

  async start(): Promise<void> {
    const config = this.state.snapshot().config;
    if (!config.autoConnect) return;
    await this.scanAndConnect(config);
  }

  async scanAndConnect(config: CompanionConfig = this.state.snapshot().config): Promise<void> {
    if (this.characteristic && this.peripheral?.state === "connected") {
      this.state.setBle("connected", this.state.snapshot().ble.device);
      return;
    }

    this.clearReconnectTimer();
    this.state.setBle("scanning");
    try {
      const nobleModule = await import("@abandonware/noble");
      this.noble ??= ((nobleModule.default ?? nobleModule) as unknown) as NobleRuntime;
      await this.waitForAdapter();
      await this.noble.startScanningAsync([normalizeUuid(config.serviceUUID)], false);

      const peripheral = await this.findPeripheral(config.deviceName);
      await this.noble.stopScanningAsync();
      await this.connectPeripheral(peripheral, config);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logs.add({ agent: "desktop", hook: "ble", result: "error", detail });
      this.state.setBle("error", null, detail);
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    if (this.peripheral?.state === "connected") {
      await this.peripheral.disconnectAsync();
    }
    this.peripheral = null;
    this.characteristic = null;
    this.state.setBle("disconnected");
  }

  async send(message: AgentMessage): Promise<boolean> {
    if (!this.characteristic) {
      this.logs.add({
        agent: message.source,
        hook: "ble",
        expression: message.expression,
        result: "error",
        detail: "BLE characteristic is not connected"
      });
      return false;
    }

    try {
      const payload = Buffer.from(createBlePayload(message), "utf8");
      await this.characteristic.writeAsync(payload, false);
      this.logs.add({
        agent: message.source,
        hook: "ble",
        expression: message.expression,
        result: "success",
        detail: payload.toString("utf8")
      });
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logs.add({
        agent: message.source,
        hook: "ble",
        expression: message.expression,
        result: "error",
        detail
      });
      this.scheduleReconnect();
      return false;
    }
  }

  async syncDisplaySchedule(config: CompanionConfig = this.state.snapshot().config): Promise<boolean> {
    if (!this.characteristic) return false;

    const payload = createDisplaySchedulePayload(config);
    try {
      await this.characteristic.writeAsync(Buffer.from(payload, "utf8"), false);
      this.logs.add({
        agent: "desktop",
        hook: "ble",
        result: "success",
        detail: `Display schedule synced: ${config.displayScheduleEnabled ? `${config.displayOffTime}-${config.displayOnTime}` : "off"}`
      });
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logs.add({ agent: "desktop", hook: "ble", result: "error", detail });
      return false;
    }
  }

  private async waitForAdapter(): Promise<void> {
    if (!this.noble) throw new Error("BLE adapter is unavailable");
    if (this.noble.state === "poweredOn") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("BLE adapter did not power on")), 10000);
      this.noble?.once("stateChange", (state) => {
        clearTimeout(timeout);
        state === "poweredOn" ? resolve() : reject(new Error(`BLE adapter state: ${state}`));
      });
    });
  }

  private async findPeripheral(deviceName: string): Promise<NoblePeripheral> {
    if (!this.noble) throw new Error("BLE adapter is unavailable");
    const noble = this.noble;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        noble.removeListener("discover", onDiscover);
        reject(new Error(`Device ${deviceName} not found`));
      }, 15000);

      const onDiscover = (peripheral: NoblePeripheral) => {
        const name = peripheral.advertisement.localName ?? "";
        if (name === deviceName || name.includes(deviceName)) {
          clearTimeout(timeout);
          noble.removeListener("discover", onDiscover);
          resolve(peripheral);
        }
      };

      noble.on("discover", onDiscover);
    });
  }

  private async connectPeripheral(peripheral: NoblePeripheral, config: CompanionConfig): Promise<void> {
    this.clearReconnectTimer();
    this.peripheral = peripheral;
    peripheral.once("disconnect", () => {
      this.characteristic = null;
      this.state.setBle("disconnected");
      this.scheduleReconnect();
    });

    await peripheral.connectAsync();
    const result = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
      [normalizeUuid(config.serviceUUID)],
      [normalizeUuid(config.characteristicUUID)]
    );

    const characteristic = result.characteristics[0];
    if (!characteristic) throw new Error("BLE write characteristic not found");

    this.characteristic = characteristic;
    this.clearReconnectTimer();
    this.state.setBle("connected", {
      id: peripheral.id,
      name: peripheral.advertisement.localName ?? config.deviceName,
      rssi: peripheral.rssi ?? null
    });
    this.logs.add({ agent: "desktop", hook: "ble", result: "success", detail: "Connected to ESP32" });
    await this.syncDisplaySchedule(config);
  }

  private scheduleReconnect(): void {
    const config = this.state.snapshot().config;
    if (this.characteristic && this.peripheral?.state === "connected") return;
    if (!config.autoConnect || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.scanAndConnect(config);
    }, 3000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
