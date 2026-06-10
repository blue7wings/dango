import { Play } from "lucide-react";
import { Expression, EXPRESSIONS } from "../shared/protocol";
import { EyePreview } from "../components/EyePreview";
import { companionApi } from "../services/api";

const expressions = Object.keys(EXPRESSIONS) as Expression[];

export function ExpressionsPage({ current }: { current: Expression }) {
  return (
    <section className="expression-grid">
      {expressions.map((expression) => (
        <article className={`expression-card ${current === expression ? "selected" : ""}`} key={expression}>
          <EyePreview expression={expression} />
          <div className="expression-card-footer">
            <span>{expression}</span>
            <button
              className="icon-command"
              title={`Test ${expression}`}
              aria-label={`Test ${expression}`}
              onClick={() => companionApi.sendExpression(expression)}
            >
              <Play size={15} fill="currentColor" />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
