import {
  AppSnapshot,
  CompanionConfig,
  DEFAULT_CHARACTERISTIC_UUID,
  DEFAULT_SERVICE_UUID,
  DeviceCommand,
  HookAgentConfig,
  HookInstallRequest,
  HookInstallResult,
  LogEntry
} from "../shared/protocol";

type SnapshotListener = (snapshot: AppSnapshot) => void;
type ApiLike = {
  getSnapshot: () => Promise<AppSnapshot>;
  updateConfig: (patch: Partial<CompanionConfig>) => Promise<AppSnapshot>;
  reconnect: () => Promise<AppSnapshot>;
  disconnect: () => Promise<AppSnapshot>;
  sendCommand: (command: DeviceCommand) => Promise<AppSnapshot>;
  syncDisplaySchedule: () => Promise<AppSnapshot>;
  syncIdleTimeout: () => Promise<AppSnapshot>;
  getAgentConfigs: () => Promise<unknown>;
  installAgentHooks: (request: HookInstallRequest) => Promise<HookInstallResult>;
  onSnapshot: (callback: SnapshotListener) => () => void;
};

const localApiBase = "http://127.0.0.1:8787";

function createLog(detail: string): LogEntry {
  const now = new Date();
  return {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    time: now.toLocaleTimeString(),
    timestamp: now.getTime(),
    source: "browser-preview",
    category: "system",
    event: "desktop_unavailable",
    expression: "idle",
    result: "info",
    detail
  };
}

class BrowserHttpApi {
  private listeners = new Set<SnapshotListener>();
  private pollTimer: number | null = null;
  private snapshot: AppSnapshot = {
    config: {
      webhookPort: 8787,
      autoConnect: true,
      deviceName: "AgentFaceESP32",
      serviceUUID: DEFAULT_SERVICE_UUID,
      characteristicUUID: DEFAULT_CHARACTERISTIC_UUID,
      displayScheduleEnabled: false,
      displayOffTime: "22:00",
      displayOnTime: "08:00",
      idleTimeoutMinutes: 10
    },
    currentEvent: "stop",
    currentCommand: { face: "idle", indicator: "off", display: "on" },
    ble: {
      status: "disconnected",
      device: null,
      lastError: "Desktop service is not reachable"
    },
    logs: [createLog("Waiting for the Electron desktop service")]
  };

  async getSnapshot() {
    await this.refreshFromDesktop();
    return this.snapshot;
  }

  async updateConfig(patch: Partial<CompanionConfig>) {
    await this.postSnapshot("/api/config", patch);
    return this.snapshot;
  }

  async reconnect() {
    await this.postSnapshot("/api/ble/reconnect");
    return this.snapshot;
  }

  async disconnect() {
    await this.postSnapshot("/api/ble/disconnect");
    return this.snapshot;
  }

  async sendCommand(command: DeviceCommand) {
    await this.postSnapshot("/api/command", command);
    return this.snapshot;
  }

  async syncDisplaySchedule() {
    await this.postSnapshot("/api/settings/schedule");
    return this.snapshot;
  }

  async syncIdleTimeout() {
    await this.postSnapshot("/api/settings/idle-timeout");
    return this.snapshot;
  }

  async getAgentConfigs() {
    try {
      return await this.request<HookAgentConfig[]>("/api/agents");
    } catch {
      return [];
    }
  }

  async installAgentHooks(request: HookInstallRequest) {
    return await this.request<HookInstallResult>("/api/agents/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
  }

  onSnapshot(callback: SnapshotListener) {
    this.listeners.add(callback);
    if (this.pollTimer === null) {
      this.pollTimer = window.setInterval(() => void this.refreshFromDesktop(), 1000);
    }
    return () => this.listeners.delete(callback);
  }

  private async refreshFromDesktop() {
    try {
      this.snapshot = await this.request<AppSnapshot>("/api/snapshot");
      this.emit();
    } catch {
      this.snapshot = {
        ...this.snapshot,
        ble: {
          ...this.snapshot.ble,
          status: "disconnected",
          lastError: "Desktop service is not reachable"
        }
      };
      this.emit();
    }
  }

  private async postSnapshot(path: string, body?: unknown) {
    try {
      const hasBody = body !== undefined;
      this.snapshot = await this.request<AppSnapshot>(path, {
        method: "POST",
        headers: hasBody ? { "content-type": "application/json" } : undefined,
        body: hasBody ? JSON.stringify(body) : undefined
      });
      this.emit();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        ble: {
          ...this.snapshot.ble,
          lastError: "Start npm run dev and use the Electron desktop service for BLE"
        }
      };
      this.emit();
      throw error;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`${localApiBase}${path}`, {
        ...init,
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(detail?.message ?? detail?.error ?? `HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private emit() {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

export const companionApi: ApiLike = window.dango ?? new BrowserHttpApi();
