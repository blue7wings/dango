import { Clock3, Save, Timer } from "lucide-react";
import { FormEvent, useState } from "react";
import { AppSnapshot, CompanionConfig } from "../shared/protocol";
import { companionApi } from "../services/api";

export function SettingsPage({ snapshot }: { snapshot: AppSnapshot }) {
  const [draft, setDraft] = useState<CompanionConfig>(snapshot.config);

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    await companionApi.updateConfig({
      displayScheduleEnabled: draft.displayScheduleEnabled,
      displayOffTime: draft.displayOffTime,
      displayOnTime: draft.displayOnTime
    });
    await companionApi.syncDisplaySchedule();
  }

  async function saveIdleTimeout(event: FormEvent) {
    event.preventDefault();
    await companionApi.updateConfig({ idleTimeoutMinutes: draft.idleTimeoutMinutes });
    await companionApi.syncIdleTimeout();
  }

  return (
    <section className="page-grid">
      <form className="panel settings-form" onSubmit={saveSchedule}>
        <div className="panel-title">
          <Clock3 size={18} />
          <span>Display Schedule</span>
        </div>
        <label className="schedule-toggle">
          <span>
            <strong>Automatic screen off</strong>
            <small>Board will turn off the screen during the configured time range</small>
          </span>
          <input
            type="checkbox"
            checked={draft.displayScheduleEnabled}
            onChange={(e) => setDraft({ ...draft, displayScheduleEnabled: e.target.checked })}
          />
        </label>
        <div className="time-grid">
          <label>
            Screen off
            <input
              type="time"
              value={draft.displayOffTime}
              disabled={!draft.displayScheduleEnabled}
              onChange={(e) => setDraft({ ...draft, displayOffTime: e.target.value })}
            />
          </label>
          <label>
            Screen on
            <input
              type="time"
              value={draft.displayOnTime}
              disabled={!draft.displayScheduleEnabled}
              onChange={(e) => setDraft({ ...draft, displayOnTime: e.target.value })}
            />
          </label>
        </div>
        <button className="primary" type="submit">
          <Save size={16} />
          <span>Save</span>
        </button>
      </form>

      <form className="panel settings-form" onSubmit={saveIdleTimeout}>
        <div className="panel-title">
          <Timer size={18} />
          <span>Idle Timeout</span>
        </div>
        <label>
          Auto-idle after no events
          <small>Board returns to idle when no command is received within this time. Set to 0 to disable.</small>
          <select
            value={draft.idleTimeoutMinutes}
            onChange={(e) => setDraft({ ...draft, idleTimeoutMinutes: parseInt(e.target.value) })}
          >
            <option value={0}>Disabled</option>
            <option value={1}>1 min</option>
            <option value={2}>2 min</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>
        <button className="primary" type="submit">
          <Save size={16} />
          <span>Save</span>
        </button>
      </form>
    </section>
  );
}
