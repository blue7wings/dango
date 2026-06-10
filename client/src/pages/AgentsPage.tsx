import { Check, CheckCircle2, FileJson, LoaderCircle, RefreshCw, Settings2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { companionApi } from "../services/api";
import { HookAgentConfig, HookAgentId, HookInstallResult } from "../shared/protocol";

export function AgentsPage() {
  const [agents, setAgents] = useState<HookAgentConfig[]>([]);
  const [selectedKiro, setSelectedKiro] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<HookAgentId | null>(null);
  const [result, setResult] = useState<HookInstallResult | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const next = await companionApi.getAgentConfigs() as HookAgentConfig[];
      setAgents(next);
      setSelectedKiro((current) => {
        const available = new Set(next.find((agent) => agent.id === "kiro")?.targets.map((target) => target.id) ?? []);
        return new Set([...current].filter((id) => available.has(id)));
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const kiro = useMemo(() => agents.find((agent) => agent.id === "kiro"), [agents]);
  const allKiroSelected = Boolean(kiro?.targets.length) && kiro!.targets.every((target) => selectedKiro.has(target.id));

  function toggleKiro(id: string) {
    setSelectedKiro((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllKiro() {
    setSelectedKiro(allKiroSelected ? new Set() : new Set(kiro?.targets.map((target) => target.id) ?? []));
  }

  async function install(agent: HookAgentId) {
    setInstalling(agent);
    setResult(null);
    try {
      const next = await companionApi.installAgentHooks({
        agent,
        targetIds: agent === "kiro" ? [...selectedKiro] : undefined
      });
      setResult(next);
      setAgents(next.agents);
    } finally {
      setInstalling(null);
    }
  }

  if (loading && agents.length === 0) {
    return <div className="agents-loading"><LoaderCircle size={20} className="spin" />Scanning agent configurations</div>;
  }

  return (
    <section className="agent-config-page">
      <div className="agent-toolbar">
        <div>
          <strong>Hook configuration</strong>
          <span>Existing hooks are preserved. Dango commands are appended only when missing.</span>
        </div>
        <button className="icon-command" title="Refresh configurations" aria-label="Refresh configurations" onClick={() => void refresh()}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      {result && (
        <div className={`install-result ${result.success ? "success" : "error"}`}>
          {result.success ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <span>
            {result.success
              ? `${result.addedHooks} hooks added across ${result.changedFiles} files.`
              : result.errors.join("; ")}
          </span>
        </div>
      )}

      {agents.map((agent) => {
        const installed = agent.targets.reduce((sum, target) => sum + target.installed, 0);
        const total = agent.targets.reduce((sum, target) => sum + target.total, 0);
        const complete = total > 0 && installed === total;
        const isKiro = agent.id === "kiro";
        const canInstall = isKiro ? selectedKiro.size > 0 : agent.targets.some((target) => target.writable);

        return (
          <article className="agent-config-panel" key={agent.id}>
            <div className="agent-config-header">
              <div className="agent-icon"><Settings2 size={19} /></div>
              <div>
                <h2>{agent.name}</h2>
                <p>{agent.description}</p>
              </div>
              <span className={`hook-summary ${complete ? "complete" : ""}`}>
                {complete && <Check size={14} />}
                {installed}/{total || 0} hooks
              </span>
            </div>

            <div className="agent-path"><FileJson size={15} /><code>{agent.path}</code></div>

            {isKiro && agent.targets.length > 0 && (
              <label className="target-select-all">
                <input type="checkbox" checked={allKiroSelected} onChange={toggleAllKiro} />
                <span>Select all agent files</span>
                <small>{selectedKiro.size} selected</small>
              </label>
            )}

            <div className="hook-target-list">
              {agent.targets.map((target) => {
                const targetComplete = target.installed === target.total;
                return (
                  <label className={`hook-target ${!target.writable ? "disabled" : ""}`} key={target.id}>
                    {isKiro && (
                      <input
                        type="checkbox"
                        checked={selectedKiro.has(target.id)}
                        disabled={!target.writable}
                        onChange={() => toggleKiro(target.id)}
                      />
                    )}
                    <span className="hook-target-name">
                      <strong>{target.name}</strong>
                      <code>{target.path}</code>
                      {target.error && <small>{target.error}</small>}
                    </span>
                    <span className={`target-status ${targetComplete ? "complete" : ""}`}>
                      {targetComplete ? "Configured" : `${target.installed}/${target.total}`}
                    </span>
                  </label>
                );
              })}
              {agent.targets.length === 0 && <div className="empty-targets">No JSON configuration files found.</div>}
            </div>

            <div className="agent-config-actions">
              <span>{complete ? "Configuration is up to date" : "Only missing hook commands will be appended"}</span>
              <button className="primary" disabled={!canInstall || installing !== null} onClick={() => void install(agent.id)}>
                {installing === agent.id ? <LoaderCircle size={16} className="spin" /> : <Settings2 size={16} />}
                <span>{complete ? "Verify and sync" : isKiro ? "Add to selected" : "Add hooks"}</span>
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
