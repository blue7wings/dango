import { contextBridge, ipcRenderer } from "electron";
import { CompanionConfig, Expression, HookInstallRequest } from "../src/shared/protocol.js";

const api = {
  getSnapshot: () => ipcRenderer.invoke("app:getSnapshot"),
  updateConfig: (patch: Partial<CompanionConfig>) => ipcRenderer.invoke("app:updateConfig", patch),
  reconnect: () => ipcRenderer.invoke("ble:reconnect"),
  disconnect: () => ipcRenderer.invoke("ble:disconnect"),
  sendExpression: (expression: Expression) => ipcRenderer.invoke("expr:send", expression),
  getAgentConfigs: () => ipcRenderer.invoke("agents:getConfigs"),
  installAgentHooks: (request: HookInstallRequest) => ipcRenderer.invoke("agents:installHooks", request),
  onSnapshot: (callback: (snapshot: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown) => callback(snapshot);
    ipcRenderer.on("app:snapshot", listener);
    return () => ipcRenderer.removeListener("app:snapshot", listener);
  }
};

contextBridge.exposeInMainWorld("clawdMochi", api);

export type ClawdMochiApi = typeof api;
