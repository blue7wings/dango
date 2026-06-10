import { BleStatus } from "../shared/protocol";

export function StatusPill({ status }: { status: BleStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}
