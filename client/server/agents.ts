import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  HookAgentConfig,
  HookAgentId,
  HookInstallRequest,
  HookInstallResult,
  HookTrigger,
  HookTarget,
  ExpressionEvent,
  EXPRESSION_EVENTS
} from "../src/shared/protocol.js";

type JsonObject = Record<string, unknown>;

const CONFIG_HOME = process.env.DANGO_CONFIG_HOME ?? os.homedir();
const CODEX_PATH = path.join(CONFIG_HOME, ".codex", "hooks.json");
const KIRO_DIR = path.join(CONFIG_HOME, ".kiro", "agents");
const HOOK_ENDPOINT = "http://127.0.0.1:8787/hook";

const CODEX_TRIGGERS: HookTrigger[] = [
  { id: "session_start", hookName: "SessionStart", defaultEvent: "ai_running", description: "A Codex thread starts or resumes." },
  { id: "user_prompt_submit", hookName: "UserPromptSubmit", defaultEvent: "ai_running", description: "The user submits a prompt." },
  { id: "pre_tool_use", hookName: "PreToolUse", defaultEvent: "tool_use", description: "A supported tool is about to run." },
  { id: "permission_request", hookName: "PermissionRequest", defaultEvent: "permission_request", description: "Codex is about to request approval." },
  { id: "post_tool_use", hookName: "PostToolUse", defaultEvent: "ai_running", description: "A supported tool has finished." },
  { id: "pre_compact", hookName: "PreCompact", defaultEvent: "tool_use", description: "Conversation compaction is about to start." },
  { id: "post_compact", hookName: "PostCompact", defaultEvent: "ai_running", description: "Conversation compaction has finished." },
  { id: "subagent_start", hookName: "SubagentStart", defaultEvent: "ai_running", description: "A Codex subagent starts." },
  { id: "subagent_stop", hookName: "SubagentStop", defaultEvent: "ai_running", description: "A Codex subagent stops." },
  { id: "stop", hookName: "Stop", defaultEvent: "stop", description: "Codex finishes the current turn." }
];

const KIRO_TRIGGERS: HookTrigger[] = [
  { id: "agent_spawn", hookName: "agentSpawn", defaultEvent: "ai_running", description: "The Kiro agent is activated." },
  { id: "user_prompt_submit", hookName: "userPromptSubmit", defaultEvent: "ai_running", description: "The user submits a prompt." },
  { id: "pre_tool_use", hookName: "preToolUse", defaultEvent: "tool_use", description: "A tool is about to run." },
  { id: "post_tool_use", hookName: "postToolUse", defaultEvent: "ai_running", description: "A tool has finished." },
  { id: "stop", hookName: "stop", defaultEvent: "stop", description: "Kiro finishes the current turn." }
];

function commandFor(event: string, source: HookAgentId): string {
  return `curl -s '${HOOK_ENDPOINT}?event=${event}&source=${source}' >/dev/null 2>&1`;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function commandsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(commandsIn);
  if (!isObject(value)) return [];
  const own = typeof value.command === "string" ? [value.command] : [];
  return own.concat(Object.values(value).flatMap(commandsIn));
}

function installedMappings(root: JsonObject, triggers: HookTrigger[], source: HookAgentId): Record<string, ExpressionEvent> {
  const hooks = isObject(root.hooks) ? root.hooks : {};
  const supportedEvents = new Set(EXPRESSION_EVENTS.map(({ event }) => event));
  return Object.fromEntries(triggers.flatMap((trigger) => {
    const command = commandsIn(hooks[trigger.hookName]).find((candidate) => candidate.includes(`${HOOK_ENDPOINT}?`) && candidate.includes(`source=${source}`));
    const event = command?.match(/[?&]event=([^&'" ]+)/)?.[1];
    return event && supportedEvents.has(event as ExpressionEvent) ? [[trigger.id, event as ExpressionEvent]] : [];
  }));
}

function hooksObject(root: JsonObject): JsonObject {
  if (root.hooks === undefined) {
    const hooks: JsonObject = {};
    root.hooks = hooks;
    return hooks;
  }
  if (!isObject(root.hooks)) throw new Error("Existing hooks value must be an object");
  return root.hooks;
}

function eventEntries(hooks: JsonObject, hookName: string): unknown[] {
  if (hooks[hookName] === undefined) {
    const entries: unknown[] = [];
    hooks[hookName] = entries;
    return entries;
  }
  if (!Array.isArray(hooks[hookName])) {
    throw new Error(`Existing hooks.${hookName} value must be an array`);
  }
  return hooks[hookName] as unknown[];
}

async function readJson(filePath: string): Promise<JsonObject> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error("Root JSON value must be an object");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function isWritable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.W_OK);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
    try {
      await access(path.dirname(filePath), constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

async function atomicWriteJson(filePath: string, value: JsonObject): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.dango-${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

function isDangoCommand(cmd: string): boolean {
  return cmd.includes(HOOK_ENDPOINT);
}

function mergeCodexHooks(root: JsonObject, mappings: Map<string, ExpressionEvent>): number {
  const hooks = hooksObject(root);
  let added = 0;

  for (const trigger of CODEX_TRIGGERS) {
    const entries = eventEntries(hooks, trigger.hookName);
    const event = mappings.get(trigger.id);
    // Remove any existing Dango entries so we always write the latest version.
    const filtered = entries.filter((entry) => !commandsIn([entry]).some(isDangoCommand));
    if (event) {
      filtered.push({
        hooks: [{ type: "command", command: commandFor(event, "codex"), timeout: 5 }]
      });
    }
    hooks[trigger.hookName] = filtered;
    if (JSON.stringify(entries) !== JSON.stringify(filtered)) added += 1;
  }
  return added;
}

function mergeKiroHooks(root: JsonObject, mappings: Map<string, ExpressionEvent>): number {
  const hooks = hooksObject(root);
  let added = 0;

  for (const trigger of KIRO_TRIGGERS) {
    const entries = eventEntries(hooks, trigger.hookName);
    const event = mappings.get(trigger.id);
    const filtered = entries.filter((entry) => !commandsIn([entry]).some(isDangoCommand));
    if (event) {
      filtered.push({
        ...(trigger.hookName === "preToolUse" || trigger.hookName === "postToolUse" ? { matcher: "*" } : {}),
        command: commandFor(event, "kiro"),
        description: "Sync agent state to Dango"
      });
    }
    hooks[trigger.hookName] = filtered;
    if (JSON.stringify(entries) !== JSON.stringify(filtered)) added += 1;
  }
  return added;
}

async function targetFor(filePath: string, triggers: HookTrigger[], source: HookAgentId): Promise<HookTarget> {
  try {
    const root = await readJson(filePath);
    return {
      id: path.basename(filePath),
      name: typeof root.name === "string" ? root.name : path.basename(filePath),
      path: filePath,
      installedMappings: installedMappings(root, triggers, source),
      writable: await isWritable(filePath)
    };
  } catch (error) {
    return {
      id: path.basename(filePath),
      name: path.basename(filePath, ".json"),
      path: filePath,
      installedMappings: {},
      writable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function inspectAgentHooks(): Promise<HookAgentConfig[]> {
  let kiroFiles: string[] = [];
  try {
    kiroFiles = (await readdir(KIRO_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(KIRO_DIR, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return [
    {
      id: "codex",
      name: "Codex",
      description: "Append Dango commands to ~/.codex/hooks.json.",
      path: CODEX_PATH,
      triggers: CODEX_TRIGGERS,
      targets: [await targetFor(CODEX_PATH, CODEX_TRIGGERS, "codex")]
    },
    {
      id: "kiro",
      name: "Kiro CLI",
      description: "Choose Kiro agent files and append hooks without changing existing commands.",
      path: KIRO_DIR,
      triggers: KIRO_TRIGGERS,
      targets: await Promise.all(kiroFiles.map((filePath) => targetFor(filePath, KIRO_TRIGGERS, "kiro")))
    }
  ];
}

export async function installAgentHooks(request: HookInstallRequest): Promise<HookInstallResult> {
  const errors: string[] = [];
  let changedFiles = 0;
  let changedHooks = 0;
  const mappings = new Map(request.mappings.map((mapping) => [mapping.triggerId, mapping.event]));
  const supportedTriggers = request.agent === "codex" ? CODEX_TRIGGERS : KIRO_TRIGGERS;
  const supportedIds = new Set(supportedTriggers.map((trigger) => trigger.id));
  const supportedEvents = new Set(EXPRESSION_EVENTS.map(({ event }) => event));
  for (const [triggerId, event] of mappings) {
    if (!supportedIds.has(triggerId)) errors.push(`${triggerId}: trigger is not supported by ${request.agent}`);
    if (!supportedEvents.has(event)) errors.push(`${event}: expression event is not supported`);
  }

  if (errors.length > 0) {
    return {
      success: false,
      changedFiles,
      changedHooks,
      errors,
      agents: await inspectAgentHooks()
    };
  }

  if (request.agent === "codex") {
    try {
      const root = await readJson(CODEX_PATH);
      const added = mergeCodexHooks(root, mappings);
      if (added > 0) {
        await atomicWriteJson(CODEX_PATH, root);
        changedFiles += 1;
        changedHooks += added;
      }
    } catch (error) {
      errors.push(`${CODEX_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (request.agent === "kiro") {
    let allowed = new Set<string>();
    try {
      allowed = new Set(
        (await readdir(KIRO_DIR, { withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map((entry) => entry.name)
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const selected = request.targetIds ?? [];
    for (const targetId of selected) {
      if (!allowed.has(targetId)) {
        errors.push(`${targetId}: file is not a Kiro agent configuration`);
        continue;
      }
      const filePath = path.join(KIRO_DIR, targetId);
      try {
        const root = await readJson(filePath);
        const added = mergeKiroHooks(root, mappings);
        if (added > 0) {
          await atomicWriteJson(filePath, root);
          changedFiles += 1;
          changedHooks += added;
        }
      } catch (error) {
        errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    changedFiles,
    changedHooks,
    errors,
    agents: await inspectAgentHooks()
  };
}
