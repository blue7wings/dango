import { Expression, EXPRESSIONS } from "../shared/protocol";

export function EyePreview({ expression }: { expression: Expression }) {
  const face = EXPRESSIONS[expression];
  const usesBlockEyes = expression === "idle";
  const usesStatusEyes = expression === "working" || expression === "error" || expression === "tool_call_start" || expression === "tool_call_end";

  return (
    <div className={`eye-preview eye-${expression}`} aria-label={expression}>
      {usesStatusEyes ? (
        <span className="preview-status-face">
          <i className={`preview-status-indicator preview-status-${expression}`} />
          <i className="preview-eye preview-working-eye preview-working-left" />
          <i className="preview-eye preview-working-eye preview-working-right" />
        </span>
      ) : usesBlockEyes ? (
        <span className="preview-block-face">
          <i className="preview-eye preview-eye-left" />
          <i className="preview-eye preview-eye-right" />
        </span>
      ) : (
        <span className="preview-face">{face}</span>
      )}
    </div>
  );
}
