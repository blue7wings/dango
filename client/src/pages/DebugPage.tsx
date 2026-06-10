import { useState } from "react";
import { DeviceCommand, Face, Indicator, DisplayPower, FACES, INDICATORS, DISPLAY_POWERS } from "../shared/protocol";
import { companionApi } from "../services/api";

export function DebugPage({ currentCommand }: { currentCommand: DeviceCommand }) {
  const [face, setFace] = useState<Face>(currentCommand.face);
  const [indicator, setIndicator] = useState<Indicator>(currentCommand.indicator);
  const [display, setDisplay] = useState<DisplayPower>(currentCommand.display);

  const send = (command: DeviceCommand) => {
    void companionApi.sendCommand(command);
  };

  return (
    <section className="debug-page">
      <div className="debug-group">
        <h3>Face</h3>
        <div className="debug-buttons">
          {FACES.map((f) => (
            <button
              key={f}
              className={face === f ? "active" : ""}
              onClick={() => { setFace(f); send({ face: f, indicator, display }); }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-group">
        <h3>Indicator</h3>
        <div className="debug-buttons">
          {INDICATORS.map((i) => (
            <button
              key={i}
              className={indicator === i ? "active" : ""}
              onClick={() => { setIndicator(i); send({ face, indicator: i, display }); }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-group">
        <h3>Display</h3>
        <div className="debug-buttons">
          {DISPLAY_POWERS.map((d) => (
            <button
              key={d}
              className={display === d ? "active" : ""}
              onClick={() => { setDisplay(d); send({ face, indicator, display: d }); }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-group">
        <h3>Current State</h3>
        <pre className="debug-state">
          {JSON.stringify({ face, indicator, display }, null, 2)}
        </pre>
      </div>
    </section>
  );
}
