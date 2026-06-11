import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BleManager } from "../server/ble.js";
import { ConfigService } from "../server/config.js";
import { LogService } from "../server/logger.js";
import { AppState } from "../server/state.js";
import { WebhookServer } from "../server/webhook.js";
import { inspectAgentHooks, installAgentHooks } from "../server/agents.js";
import { CompanionConfig, DeviceCommand, HookInstallRequest } from "../src/shared/protocol.js";
import { createTray } from "./tray.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const config = new ConfigService();
const logs = new LogService();
const state = new AppState(config, logs);
const ble = new BleManager(state, logs);
const webhook = new WebhookServer(state, {
  reconnect: () => ble.scanAndConnect(),
  disconnect: () => ble.disconnect(),
  sendCommand: async (command) => {
    const message = state.sendCommand(command);
    await ble.send(message);
  },
  updateConfig: async (patch) => {
    const next = state.updateConfig(patch);
    if (next.autoConnect) void ble.scanAndConnect(next);
  },
  syncDisplaySchedule: async () => {
    await ble.syncDisplaySchedule();
  },
  syncIdleTimeout: async () => {
    await ble.syncIdleTimeout();
  }
});

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: "Dango Companion",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5188");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("close", (event) => {
    // Closing the window hides to tray; the app only exits via the tray Quit
    // action, which sets isQuitting before triggering app.quit().
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function broadcastSnapshot(): void {
  mainWindow?.webContents.send("app:snapshot", state.snapshot());
}

function registerIpc(): void {
  ipcMain.handle("app:getSnapshot", () => state.snapshot());
  ipcMain.handle("app:updateConfig", async (_event, patch: Partial<CompanionConfig>) => {
    const next = state.updateConfig(patch);
    await webhook.start(next.webhookPort);
    if (next.autoConnect) void ble.scanAndConnect(next);
    return state.snapshot();
  });
  ipcMain.handle("settings:syncSchedule", async () => {
    await ble.syncDisplaySchedule();
    return state.snapshot();
  });
  ipcMain.handle("settings:syncIdleTimeout", async () => {
    await ble.syncIdleTimeout();
    return state.snapshot();
  });
  ipcMain.handle("ble:reconnect", async () => {
    await ble.scanAndConnect();
    return state.snapshot();
  });
  ipcMain.handle("ble:disconnect", async () => {
    await ble.disconnect();
    return state.snapshot();
  });
  ipcMain.handle("expr:send", async (_event, command: DeviceCommand) => {
    const message = state.sendCommand(command);
    await ble.send(message);
    return state.snapshot();
  });
  ipcMain.handle("agents:getConfigs", () => inspectAgentHooks());
  ipcMain.handle("agents:installHooks", (_event, request: HookInstallRequest) => installAgentHooks(request));
}

app.whenReady().then(async () => {
  registerIpc();
  state.on("changed", broadcastSnapshot);
  state.on("agent-message", (message) => void ble.send(message));

  await webhook.start(config.get().webhookPort);
  await createWindow();
  createTray(state, ble, () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      void createWindow();
    }
  });

  void ble.start();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  // No-op: closing windows hides the app to the tray on every platform.
  // The process only exits through the tray Quit action.
});

app.on("before-quit", (event) => {
  if (isQuitting) return;
  // Run async teardown (stop the webhook server on 8787, disconnect BLE)
  // before the process exits, then quit for real.
  event.preventDefault();
  isQuitting = true;
  void (async () => {
    try {
      state.dispose();
      await webhook.stop();
      await ble.disconnect();
    } catch (error) {
      logs.add({
        source: "desktop",
        category: "system",
        event: "shutdown",
        result: "error",
        detail: `Shutdown cleanup failed: ${String(error)}`
      });
    } finally {
      app.quit();
    }
  })();
});
