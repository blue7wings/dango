import { Bot, FileText, Gauge, Radio, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useSnapshot } from "./hooks/useSnapshot";
import { Dashboard } from "./pages/Dashboard";
import { BlePage } from "./pages/BlePage";
import { AgentsPage } from "./pages/AgentsPage";
import { ExpressionsPage } from "./pages/ExpressionsPage";
import { LogsPage } from "./pages/LogsPage";

type Page = "dashboard" | "ble" | "agents" | "expressions" | "logs";

const nav = [
  { id: "dashboard" as const, label: "Dashboard", icon: Gauge },
  { id: "ble" as const, label: "BLE", icon: Radio },
  { id: "agents" as const, label: "Agents", icon: Bot },
  { id: "expressions" as const, label: "Expressions", icon: SlidersHorizontal },
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
            <strong>Clawd Mochi</strong>
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
          <div className="header-face">{snapshot.currentExpression}</div>
        </header>

        {page === "dashboard" && <Dashboard snapshot={snapshot} />}
        {page === "ble" && <BlePage snapshot={snapshot} />}
        {page === "agents" && <AgentsPage />}
        {page === "expressions" && <ExpressionsPage current={snapshot.currentExpression} />}
        {page === "logs" && <LogsPage snapshot={snapshot} />}
      </section>
    </main>
  );
}
