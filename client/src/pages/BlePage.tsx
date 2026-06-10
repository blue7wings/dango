import { Clock3, PlugZap, RefreshCw, Save, Unplug } from "lucide-react";
import { FormEvent, useState } from "react";
import { AppSnapshot, CompanionConfig } from "../shared/protocol";
import { StatusPill } from "../components/StatusPill";
import { companionApi } from "../services/api";

export function BlePage({ snapshot }: { snapshot: AppSnapshot }) {
  const [draft, setDraft] = useState<CompanionConfig>(snapshot.config);

  async function save(event: FormEvent) {
    event.preventDefault();
    await companionApi.updateConfig(draft);
  }

  return (
    <section className="page-grid">
      <div className="panel">
        <div className="panel-title">
          <PlugZap size={18} />
          <span>Device</span>
        </div>
        <div className="device-card">
          <span>Device:</span>
          <strong>{snapshot.ble.device?.name ?? draft.deviceName}</strong>
          <span>Status:</span>
          <StatusPill status={snapshot.ble.status} />
          <span>RSSI:</span>
          <strong>{snapshot.ble.device?.rssi ?? "n/a"}</strong>
        </div>
        {snapshot.ble.lastError && <p className="error-text">{snapshot.ble.lastError}</p>}
        <div className="button-row">
          <button onClick={() => companionApi.reconnect()}>
            <RefreshCw size={16} />
            <span>Scan</span>
          </button>
          <button onClick={() => companionApi.disconnect()}>
            <Unplug size={16} />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      <form className="panel schedule-panel" onSubmit={save}>
        <div className="panel-title">
          <Clock3 size={18} />
          <span>Display Schedule</span>
        </div>
        <label className="schedule-toggle">
          <span>
            <strong>Automatic screen</strong>
            <small>Use the computer clock to keep the board on schedule</small>
          </span>
          <input
            type="checkbox"
            checked={draft.displayScheduleEnabled}
            onChange={(event) => setDraft({ ...draft, displayScheduleEnabled: event.target.checked })}
          />
        </label>
        <div className="time-grid">
          <label>
            Screen off
            <input
              type="time"
              value={draft.displayOffTime}
              disabled={!draft.displayScheduleEnabled}
              onChange={(event) => setDraft({ ...draft, displayOffTime: event.target.value })}
            />
          </label>
          <label>
            Screen on
            <input
              type="time"
              value={draft.displayOnTime}
              disabled={!draft.displayScheduleEnabled}
              onChange={(event) => setDraft({ ...draft, displayOnTime: event.target.value })}
            />
          </label>
        </div>
        <button className="primary" type="submit">
          <Save size={16} />
          <span>Apply schedule</span>
        </button>
      </form>

      <form className="panel wide" onSubmit={save}>
        <div className="panel-title">
          <Save size={18} />
          <span>BLE UUIDs</span>
        </div>
        <label>
          Device Name
          <input value={draft.deviceName} onChange={(event) => setDraft({ ...draft, deviceName: event.target.value })} />
        </label>
        <label>
          Service UUID
          <input value={draft.serviceUUID} onChange={(event) => setDraft({ ...draft, serviceUUID: event.target.value })} />
        </label>
        <label>
          Characteristic UUID
          <input
            value={draft.characteristicUUID}
            onChange={(event) => setDraft({ ...draft, characteristicUUID: event.target.value })}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.autoConnect}
            onChange={(event) => setDraft({ ...draft, autoConnect: event.target.checked })}
          />
          <span>Auto connect</span>
        </label>
        <button className="primary" type="submit">
          <Save size={16} />
          <span>Save</span>
        </button>
      </form>
    </section>
  );
}
