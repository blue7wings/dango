import Store from "electron-store";
import {
  CompanionConfig,
  DEFAULT_CHARACTERISTIC_UUID,
  DEFAULT_SERVICE_UUID
} from "../src/shared/protocol.js";

const defaults: CompanionConfig = {
  webhookPort: 8787,
  autoConnect: true,
  deviceName: "AgentFaceESP32",
  serviceUUID: DEFAULT_SERVICE_UUID,
  characteristicUUID: DEFAULT_CHARACTERISTIC_UUID,
  displayScheduleEnabled: false,
  displayOffTime: "22:00",
  displayOnTime: "08:00",
  idleTimeoutMinutes: 10
};

export class ConfigService {
  private readonly store = new Store<CompanionConfig>({ defaults });

  get(): CompanionConfig {
    return { ...defaults, ...this.store.store };
  }

  update(patch: Partial<CompanionConfig>): CompanionConfig {
    const next = { ...this.get(), ...patch };
    this.store.set(next);
    return next;
  }
}
