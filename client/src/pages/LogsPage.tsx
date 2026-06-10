import { AppSnapshot } from "../shared/protocol";

export function LogsPage({ snapshot }: { snapshot: AppSnapshot }) {
  return (
    <section className="panel wide full">
      <div className="log-table">
        <div className="log-head">
          <span>Time</span>
          <span>Agent</span>
          <span>Hook</span>
          <span>Expression</span>
          <span>Result</span>
          <span>Detail</span>
        </div>
        {snapshot.logs.map((log) => (
          <div className="log-row" key={log.id}>
            <time>{log.time}</time>
            <span>{log.agent}</span>
            <span>{log.hook}</span>
            <span>{log.expression ?? ""}</span>
            <strong className={log.result}>{log.result}</strong>
            <span>{log.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
