import { FileJson, LoaderCircle, RefreshCw, Save, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { errorMessage, useNotification } from "../components/NotificationProvider";
import { companionApi } from "../services/api";
import { EXPRESSION_EVENTS, ExpressionEvent, HookAgentConfig, HookAgentId } from "../shared/protocol";

type TriggerMapping = Record<string, ExpressionEvent>;
type AgentMappings = Record<HookAgentId, TriggerMapping>;

const EMPTY_MAPPINGS: AgentMappings = {
  codex: {},
  kiro: {}
};

export function AgentsPage() {
  const notification = useNotification();
  const [agents, setAgents] = useState<HookAgentConfig[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<HookAgentId>("codex");
  const [triggerMappings, setTriggerMappings] = useState<AgentMappings>(EMPTY_MAPPINGS);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  async function refresh(resetSelections = false, announce = false) {
    setLoading(true);
    try {
      const next = await companionApi.getAgentConfigs() as HookAgentConfig[];
      setAgents(next);

      if (resetSelections) {
        setTriggerMappings({
          codex: initialTriggerMappings(next.find((agent) => agent.id === "codex")),
          kiro: initialTriggerMappings(next.find((agent) => agent.id === "kiro"))
        });
        setSelectedTargets(new Set(
          next.find((agent) => agent.id === "kiro")?.targets
            .filter((target) => target.writable)
            .map((target) => target.id) ?? []
        ));
      }
      if (announce) notification.success("Trigger configurations refreshed.");
    } catch (error) {
      if (announce) notification.error(errorMessage(error, "Could not refresh trigger configurations."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId),
    [activeAgentId, agents]
  );
  const activeMappings = triggerMappings[activeAgentId];
  const isKiro = activeAgentId === "kiro";
  const selectedTargetCount = isKiro ? selectedTargets.size : 1;
  const canSync = Boolean(activeAgent) && selectedTargetCount > 0 && !installing;

  function toggleTrigger(id: string) {
    if (!activeAgent) return;
    setTriggerMappings((current) => {
      const next = { ...current[activeAgentId] };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = activeAgent.triggers.find((trigger) => trigger.id === id)?.defaultEvent ?? "ai_running";
      }
      return { ...current, [activeAgentId]: next };
    });
  }

  function setTriggerEvent(id: string, event: ExpressionEvent) {
    setTriggerMappings((current) => ({
      ...current,
      [activeAgentId]: { ...current[activeAgentId], [id]: event }
    }));
  }

  function toggleAllTriggers() {
    if (!activeAgent) return;
    const allSelected = activeAgent.triggers.every((trigger) => activeMappings[trigger.id]);
    setTriggerMappings((current) => ({
      ...current,
      [activeAgentId]: allSelected
        ? {}
        : Object.fromEntries(activeAgent.triggers.map((trigger) => [trigger.id, current[activeAgentId][trigger.id] ?? trigger.defaultEvent]))
    }));
  }

  function toggleTarget(id: string) {
    setSelectedTargets((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function syncTriggers() {
    if (!activeAgent) return;
    setInstalling(true);
    try {
      const next = await companionApi.installAgentHooks({
        agent: activeAgent.id,
        mappings: Object.entries(activeMappings).map(([triggerId, event]) => ({ triggerId, event })),
        targetIds: isKiro ? [...selectedTargets] : undefined
      });
      setAgents(next.agents);
      if (next.success) {
        notification.success(`${next.changedHooks} trigger changes synced across ${next.changedFiles} files.`);
      } else {
        notification.error(next.errors.join("; ") || "Could not sync triggers.");
      }
    } catch (error) {
      notification.error(errorMessage(error, "Could not sync triggers."));
    } finally {
      setInstalling(false);
    }
  }

  if (loading && agents.length === 0) {
    return <div className="agents-loading"><LoaderCircle size={20} className="spin" />Scanning trigger configurations</div>;
  }

  if (!activeAgent) return null;

  const allTriggersSelected = activeAgent.triggers.every((trigger) => activeMappings[trigger.id]);
  const configuredCount = configuredTriggerCount(activeAgent, isKiro ? selectedTargets : undefined);

  return (
    <section className="trigger-page">
      <div className="trigger-toolbar">
        <div>
          <strong>Agent triggers</strong>
          <span>Choose which lifecycle events should be sent to Dango.</span>
        </div>
        <button className="icon-command" title="Refresh configurations" aria-label="Refresh configurations" onClick={() => void refresh(true, true)}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      <div className="agent-switcher" role="tablist" aria-label="Agent">
        {agents.map((agent) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeAgentId === agent.id}
            className={activeAgentId === agent.id ? "active" : ""}
            key={agent.id}
            onClick={() => setActiveAgentId(agent.id)}
          >
            <Zap size={16} />
            <span>{agent.name}</span>
            <small>{agent.triggers.length}</small>
          </button>
        ))}
      </div>

      <article className="trigger-panel">
        <div className="trigger-panel-header">
          <div>
            <h2>{activeAgent.name}</h2>
            <p>{activeAgent.description}</p>
          </div>
          <span>{configuredCount}/{activeAgent.triggers.length} configured</span>
        </div>

        <div className="trigger-path"><FileJson size={15} /><code>{activeAgent.path}</code></div>

        {isKiro && (
          <div className="trigger-section">
            <div className="trigger-section-heading">
              <div><strong>1. Agent files</strong><span>Select where these triggers should be synced.</span></div>
              <small>{selectedTargets.size} selected</small>
            </div>
            <div className="target-chip-list">
              {activeAgent.targets.map((target) => (
                <label className={`target-chip ${!target.writable ? "disabled" : ""}`} key={target.id}>
                  <input
                    type="checkbox"
                    checked={selectedTargets.has(target.id)}
                    disabled={!target.writable}
                    onChange={() => toggleTarget(target.id)}
                  />
                  <span><strong>{target.name}</strong><code>{target.path}</code></span>
                  {target.error && <small>{target.error}</small>}
                </label>
              ))}
              {activeAgent.targets.length === 0 && <div className="empty-targets">No Kiro agent JSON files found.</div>}
            </div>
          </div>
        )}

        <div className="trigger-section">
          <div className="trigger-section-heading">
            <div><strong>{isKiro ? "2. Expressions" : "Expressions"}</strong><span>Choose the Dango expression triggered by each enabled hook.</span></div>
            <button type="button" className="text-command" onClick={toggleAllTriggers}>
              {allTriggersSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          <div className="trigger-list">
            {activeAgent.triggers.map((trigger) => {
              const enabled = Boolean(activeMappings[trigger.id]);
              return (
                <div className={`trigger-row ${enabled ? "enabled" : ""}`} key={trigger.id}>
                  <input
                    type="checkbox"
                    aria-label={`Enable ${trigger.hookName}`}
                    checked={enabled}
                    onChange={() => toggleTrigger(trigger.id)}
                  />
                  <span className="trigger-copy">
                    <strong>{trigger.hookName}</strong>
                    <small>{trigger.description}</small>
                  </span>
                  <span className="trigger-event">
                    <small>triggers</small>
                    <select
                      aria-label={`${trigger.hookName} expression`}
                      disabled={!enabled}
                      value={activeMappings[trigger.id] ?? trigger.defaultEvent}
                      onChange={(event) => setTriggerEvent(trigger.id, event.target.value as ExpressionEvent)}
                    >
                      {EXPRESSION_EVENTS.map((option) => (
                        <option value={option.event} key={option.event}>{option.label} ({option.event})</option>
                      ))}
                    </select>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="trigger-actions">
          <span>{Object.keys(activeMappings).length} of {activeAgent.triggers.length} triggers enabled</span>
          <button className="primary" disabled={!canSync} onClick={() => void syncTriggers()}>
            {installing ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
            <span>Sync triggers</span>
          </button>
        </div>
      </article>
    </section>
  );
}

function initialTriggerMappings(agent: HookAgentConfig | undefined): TriggerMapping {
  if (!agent) return {};
  const installed = Object.assign({}, ...agent.targets.map((target) => target.installedMappings));
  return Object.keys(installed).length > 0
    ? installed
    : Object.fromEntries(agent.triggers.map((trigger) => [trigger.id, trigger.defaultEvent]));
}

function configuredTriggerCount(agent: HookAgentConfig, selectedTargets?: Set<string>): number {
  const targets = selectedTargets
    ? agent.targets.filter((target) => selectedTargets.has(target.id))
    : agent.targets;
  if (targets.length === 0) return 0;
  return agent.triggers.filter((trigger) => targets.every((target) => target.installedMappings[trigger.id])).length;
}
