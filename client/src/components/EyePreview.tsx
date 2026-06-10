import { Face, Indicator } from "../shared/protocol";

export function EyePreview({ face, indicator }: { face: Face; indicator?: Indicator }) {
  const indicatorClass = indicator && indicator !== "off" ? `preview-indicator-${indicator}` : "";

  return (
    <div className={`eye-preview eye-${face}`} aria-label={face}>
      {face === "idle" ? (
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
      )}
    </div>
  );
}
