import { app, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppState } from "../server/state.js";
import { BleManager } from "../server/ble.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createTrayIcon(): Electron.NativeImage {
  // tray.js runs from dist-electron/electron, so ../../assets resolves to the
  // bundled assets folder in both dev and packaged (asar) builds.
  const iconPath = path.join(__dirname, "../../assets/trayTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) return nativeImage.createEmpty();
  // Template image: macOS recolors it for light/dark menu bars automatically.
  icon.setTemplateImage(true);
  return icon;
}

export function createTray(state: AppState, ble: BleManager, openWindow: () => void): Tray {
  const tray = new Tray(createTrayIcon());

  const refresh = () => {
    const snapshot = state.snapshot();
    const deviceLine = snapshot.ble.device
      ? `${snapshot.ble.device.name} (${snapshot.ble.device.rssi ?? "n/a"} dBm)`
      : "No device";

    tray.setToolTip(`Dango: ${snapshot.currentCommand.face} / ${snapshot.currentCommand.indicator}`);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `State: ${snapshot.currentCommand.face} / ${snapshot.currentCommand.indicator}`, enabled: false },
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
