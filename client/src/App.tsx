import { Bot, Bug, FileText, Gauge, Radio, Settings, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useSnapshot } from "./hooks/useSnapshot";
import { Dashboard } from "./pages/Dashboard";
import { BlePage } from "./pages/BlePage";
import { AgentsPage } from "./pages/AgentsPage";
import { ExpressionsPage } from "./pages/ExpressionsPage";
import { LogsPage } from "./pages/LogsPage";
import { DebugPage } from "./pages/DebugPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "dashboard" | "ble" | "agents" | "expressions" | "logs" | "debug" | "settings";

const nav = [
  { id: "dashboard" as const, label: "Dashboard", icon: Gauge },
  { id: "ble" as const, label: "BLE", icon: Radio },
  { id: "agents" as const, label: "Agents", icon: Bot },
  { id: "expressions" as const, label: "Expressions", icon: SlidersHorizontal },
  { id: "debug" as const, label: "Debug", icon: Bug },
  { id: "settings" as const, label: "Settings", icon: Settings },
  { id: "logs" as const, label: "Logs", icon: FileText }
];

export default function App() {
  const snapshot = useSnapshot();
  const [page, setPage] = useState<Page>("dashboard");

  if (!snapshot) return <main className="loading">Loading</main>;

  return (
    <main className="shell">
      <aside>
        <div className="brand">
          <div className="brand-mark">- -</div>
          <div>
            <strong>Dango</strong>
            <span>Agent Companion</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="content">
        <header>
          <div>
            <span className="eyebrow">127.0.0.1:{snapshot.config.webhookPort}</span>
            <h1>{nav.find((item) => item.id === page)?.label}</h1>
          </div>
          <div className="header-face">{snapshot.currentCommand.face} / {snapshot.currentCommand.indicator}</div>
        </header>

        {page === "dashboard" && <Dashboard snapshot={snapshot} />}
        {page === "ble" && <BlePage snapshot={snapshot} />}
        {page === "agents" && <AgentsPage />}
        {page === "expressions" && <ExpressionsPage currentCommand={snapshot.currentCommand} />}
        {page === "debug" && <DebugPage currentCommand={snapshot.currentCommand} />}
        {page === "settings" && <SettingsPage snapshot={snapshot} />}
        {page === "logs" && <LogsPage snapshot={snapshot} />}
      </section>
    </main>
  );
}
