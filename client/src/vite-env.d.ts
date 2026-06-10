/// <reference types="vite/client" />

import type { AppSnapshot, CompanionConfig, DeviceCommand, HookInstallRequest, HookInstallResult } from "./shared/protocol";

declare global {
  interface Window {
    dango?: {
      getSnapshot: () => Promise<AppSnapshot>;
      updateConfig: (patch: Partial<CompanionConfig>) => Promise<AppSnapshot>;
      reconnect: () => Promise<AppSnapshot>;
      disconnect: () => Promise<AppSnapshot>;
      sendCommand: (command: DeviceCommand) => Promise<AppSnapshot>;
      syncDisplaySchedule: () => Promise<AppSnapshot>;
      syncIdleTimeout: () => Promise<AppSnapshot>;
      getAgentConfigs: () => Promise<unknown>;
      installAgentHooks: (request: HookInstallRequest) => Promise<HookInstallResult>;
      onSnapshot: (callback: (snapshot: AppSnapshot) => void) => () => void;
    };
  }
}
