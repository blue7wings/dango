import { Play } from "lucide-react";
import { DeviceCommand } from "../shared/protocol";
import { EyePreview } from "../components/EyePreview";
import { companionApi } from "../services/api";

const PRESETS: { label: string; command: DeviceCommand }[] = [
  { label: "Idle", command: { face: "idle", indicator: "off", display: "on" } },
  { label: "Working", command: { face: "focused", indicator: "green_breathe", display: "on" } },
  { label: "Tool Call", command: { face: "focused", indicator: "yellow_breathe", display: "on" } },
  { label: "Success", command: { face: "focused", indicator: "green_solid", display: "on" } },
  { label: "Error", command: { face: "focused", indicator: "red_solid", display: "on" } },
  { label: "Permission", command: { face: "focused", indicator: "red_breathe", display: "on" } },
];

export function ExpressionsPage({ currentCommand }: { currentCommand: DeviceCommand }) {
  return (
    <section className="expression-grid">
      {PRESETS.map(({ label, command }) => {
        const active =
          currentCommand.face === command.face &&
          currentCommand.indicator === command.indicator &&
          currentCommand.display === command.display;
        return (
          <article className={`expression-card ${active ? "selected" : ""}`} key={label}>
            <EyePreview face={command.face} indicator={command.indicator} />
            <div className="expression-card-footer">
              <span>{label}</span>
              <button
                className="icon-command"
                title={`Send ${label}`}
                aria-label={`Send ${label}`}
                onClick={() => companionApi.sendCommand(command)}
              >
                <Play size={15} fill="currentColor" />
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
