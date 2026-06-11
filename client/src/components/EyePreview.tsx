import { DisplayPower, Face, Indicator } from "../shared/protocol";

export function EyePreview({ face, indicator, display = "on" }: { face: Face; indicator?: Indicator; display?: DisplayPower }) {
  const indicatorClass = indicator && indicator !== "off" ? `preview-indicator-${indicator}` : "";
  const displayOff = display === "off";

  return (
    <div className={`eye-preview eye-${face} ${displayOff ? "eye-display-off" : ""}`} aria-label={displayOff ? "display off" : face}>
      {!displayOff && (face === "idle" ? (
        <span className="preview-block-face">
          <i className="preview-eye preview-eye-left" />
          <i className="preview-eye preview-eye-right" />
        </span>
      ) : (
        <span className="preview-status-face">
          {indicatorClass && <i className={`preview-status-indicator ${indicatorClass}`} />}
          <i className="preview-eye preview-working-eye preview-working-left" />
          <i className="preview-eye preview-working-eye preview-working-right" />
        </span>
      ))}
    </div>
  );
}
