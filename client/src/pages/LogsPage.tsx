import { AppSnapshot } from "../shared/protocol";
import { formatLogCategory, formatLogDetail, formatLogEvent, getLogPresentation } from "../utils/logs";

export function LogsPage({ snapshot }: { snapshot: AppSnapshot }) {
  return (
    <section className="panel wide full">
      <div className="log-list">
        {snapshot.logs.map((log) => {
          const presentation = getLogPresentation(log);
          return (
            <div className="log-row" key={log.id}>
              <div className="log-summary">
                <span className={`log-category ${presentation.category}`}>
                  {formatLogCategory(presentation.category)}
                </span>
                <strong className="log-event">{formatLogEvent(presentation.event)}</strong>
                <span className="log-source">{presentation.source}</span>
                <strong className={`log-result ${log.result}`}>{log.result}</strong>
                <time>{log.time}</time>
              </div>
              <pre className="log-detail">{formatLogDetail(log.detail)}</pre>
            </div>
          );
        })}
        {snapshot.logs.length === 0 && <div className="empty">No logs yet</div>}
      </div>
    </section>
  );
}
