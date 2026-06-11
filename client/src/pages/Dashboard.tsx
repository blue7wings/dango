import { Activity, Cpu, Radio, Zap } from "lucide-react";
import { AppSnapshot } from "../shared/protocol";
import { EyePreview } from "../components/EyePreview";
import { StatusPill } from "../components/StatusPill";
import { formatLogCategory, formatLogEvent, getLogPresentation } from "../utils/logs";

export function Dashboard({ snapshot }: { snapshot: AppSnapshot }) {
  const latest = snapshot.logs.slice(0, 5);
  return (
    <section className="page-grid">
      <div className="panel expression-panel">
        <div className="panel-title">
          <Activity size={18} />
          <span>Current State</span>
        </div>
        <EyePreview face={snapshot.currentCommand.face} />
        <div className="state-row">
          <span>{snapshot.currentEvent}</span>
          <strong>{snapshot.currentCommand.face} / {snapshot.currentCommand.indicator}</strong>
        </div>
      </div>

      <div className="panel metrics-panel">
        <div className="metric">
          <Radio size={18} />
          <span>BLE</span>
          <StatusPill status={snapshot.ble.status} />
        </div>
        <div className="metric">
          <Cpu size={18} />
          <span>Device</span>
          <strong>{snapshot.ble.device?.name ?? snapshot.config.deviceName}</strong>
        </div>
        <div className="metric">
          <Zap size={18} />
          <span>RSSI</span>
          <strong>{snapshot.ble.device?.rssi ?? "n/a"}</strong>
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-title">
          <Activity size={18} />
          <span>Recent Events</span>
        </div>
        <div className="event-list">
          {latest.map((log) => {
            const presentation = getLogPresentation(log);
            return (
              <div className="event-row" key={log.id}>
                <time>{log.time}</time>
                <span>{formatLogCategory(presentation.category)}</span>
                <span>{formatLogEvent(presentation.event)}</span>
                <strong>{log.result}</strong>
              </div>
            );
          })}
          {latest.length === 0 && <div className="empty">No events yet</div>}
        </div>
      </div>
    </section>
  );
}
