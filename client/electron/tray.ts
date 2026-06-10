import { app, Menu, nativeImage, Tray } from "electron";
import { AppState } from "../server/state.js";
import { BleManager } from "../server/ble.js";

export function createTray(state: AppState, ble: BleManager, openWindow: () => void): Tray {
  const icon = nativeImage.createEmpty();
  const tray = new Tray(icon);

  const refresh = () => {
    const snapshot = state.snapshot();
    const deviceLine = snapshot.ble.device
      ? `${snapshot.ble.device.name} (${snapshot.ble.device.rssi ?? "n/a"} dBm)`
      : "No device";

    tray.setToolTip(`Clawd Mochi: ${snapshot.currentExpression}`);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `State: ${snapshot.currentExpression}`, enabled: false },
        { label: `Device: ${deviceLine}`, enabled: false },
        { label: `BLE: ${snapshot.ble.status}`, enabled: false },
        { type: "separator" },
        { label: "Reconnect Device", click: () => void ble.scanAndConnect() },
        { label: "Open Control Panel", click: openWindow },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() }
      ])
    );
  };

  state.on("changed", refresh);
  refresh();
  return tray;
}
