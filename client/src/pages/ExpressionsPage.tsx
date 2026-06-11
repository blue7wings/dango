import { Play } from "lucide-react";
import { DeviceCommand, EXPRESSION_EVENTS, resolveCommand } from "../shared/protocol";
import { EyePreview } from "../components/EyePreview";
import { companionApi } from "../services/api";
import { errorMessage, useNotification } from "../components/NotificationProvider";

const PRESETS = EXPRESSION_EVENTS.map(({ event, label }) => ({ label, command: resolveCommand(event) }));

export function ExpressionsPage({ currentCommand }: { currentCommand: DeviceCommand }) {
  const notification = useNotification();

  async function send(label: string, command: DeviceCommand) {
    try {
      await companionApi.sendCommand(command);
      notification.success(`${label} expression sent to Dango.`);
    } catch (error) {
      notification.error(errorMessage(error, `Could not send the ${label} expression.`));
    }
  }

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
                onClick={() => void send(label, command)}
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
