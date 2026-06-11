import { Bluetooth, RefreshCw, Save, Signal, Unplug } from "lucide-react";
import { FormEvent, useState } from "react";
import { errorMessage, useNotification } from "../components/NotificationProvider";
import { AppSnapshot, CompanionConfig } from "../shared/protocol";
import { StatusPill } from "../components/StatusPill";
import { companionApi } from "../services/api";

export function BlePage({ snapshot }: { snapshot: AppSnapshot }) {
  const notification = useNotification();
  const [draft, setDraft] = useState<CompanionConfig>(snapshot.config);
  const [pending, setPending] = useState<"scan" | "disconnect" | "save" | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending("save");
    try {
      await companionApi.updateConfig(draft);
      notification.success("Connection settings saved.");
    } catch (error) {
      notification.error(errorMessage(error, "Could not save connection settings."));
    } finally {
      setPending(null);
    }
  }

  async function reconnect() {
    setPending("scan");
    try {
      await companionApi.reconnect();
      notification.success("Bluetooth scan started.");
    } catch (error) {
      notification.error(errorMessage(error, "Could not start Bluetooth scan."));
    } finally {
      setPending(null);
    }
  }

  async function disconnect() {
    setPending("disconnect");
    try {
      await companionApi.disconnect();
      notification.success("Bluetooth device disconnected.");
    } catch (error) {
      notification.error(errorMessage(error, "Could not disconnect the Bluetooth device."));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="ble-page">
      <div className="panel ble-overview">
        <div className="ble-overview-main">
          <div className="ble-device-icon">
            <Bluetooth size={20} />
          </div>
          <div className="ble-device-copy">
            <div className="ble-device-title">
              <h2>{snapshot.ble.device?.name ?? draft.deviceName}</h2>
              <StatusPill status={snapshot.ble.status} />
            </div>
            <span>{snapshot.ble.device?.id ?? "Waiting for device discovery"}</span>
          </div>
        </div>

        <div className="ble-overview-meta">
          <div>
            <Signal size={15} />
            <span>Signal</span>
            <strong>{snapshot.ble.device?.rssi ?? "--"}{snapshot.ble.device?.rssi != null ? " dBm" : ""}</strong>
          </div>
          <div>
            <span>Auto connect</span>
            <strong>{draft.autoConnect ? "On" : "Off"}</strong>
          </div>
        </div>

        <div className="ble-actions">
          <button disabled={pending !== null} onClick={() => void reconnect()}>
            <RefreshCw size={15} />
            <span>{pending === "scan" ? "Scanning..." : "Scan"}</span>
          </button>
          <button disabled={pending !== null} onClick={() => void disconnect()}>
            <Unplug size={15} />
            <span>{pending === "disconnect" ? "Disconnecting..." : "Disconnect"}</span>
          </button>
        </div>

        {snapshot.ble.lastError && <p className="ble-error">{snapshot.ble.lastError}</p>}
      </div>

      <form className="panel ble-config" onSubmit={save}>
        <div className="ble-section-heading">
          <div>
            <h2>Connection settings</h2>
            <p>Update the Bluetooth identity used to find and control your Dango device.</p>
          </div>
        </div>

        <div className="ble-form-grid">
          <label>
            <span>Device name</span>
            <input value={draft.deviceName} onChange={(event) => setDraft({ ...draft, deviceName: event.target.value })} />
            <small>Bluetooth name advertised by the device</small>
          </label>
          <label>
            <span>Service UUID</span>
            <input value={draft.serviceUUID} onChange={(event) => setDraft({ ...draft, serviceUUID: event.target.value })} />
            <small>Primary BLE service</small>
          </label>
          <label>
            <span>Characteristic UUID</span>
            <input
              value={draft.characteristicUUID}
              onChange={(event) => setDraft({ ...draft, characteristicUUID: event.target.value })}
            />
            <small>Writable command characteristic</small>
          </label>
        </div>

        <div className="ble-config-footer">
          <label className="ble-auto-connect">
            <input
              type="checkbox"
              checked={draft.autoConnect}
              onChange={(event) => setDraft({ ...draft, autoConnect: event.target.checked })}
            />
            <span>
              <strong>Connect automatically</strong>
              <small>Scan for the device when Dango starts</small>
            </span>
          </label>
          <button className="primary" type="submit" disabled={pending !== null}>
            <Save size={15} />
            <span>{pending === "save" ? "Saving..." : "Save changes"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
