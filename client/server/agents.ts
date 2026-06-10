import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  HookAgentConfig,
  HookAgentId,
  HookInstallRequest,
  HookInstallResult,
  HookTarget
} from "../src/shared/protocol.js";

type JsonObject = Record<string, unknown>;

const CONFIG_HOME = process.env.DANGO_CONFIG_HOME ?? os.homedir();
const CODEX_PATH = path.join(CONFIG_HOME, ".codex", "hooks.json");
const KIRO_DIR = path.join(CONFIG_HOME, ".kiro", "agents");
const HOOK_ENDPOINT = "http://127.0.0.1:8787/hook";

const CODEX_EVENTS: Record<string, string> = {
  SessionStart: "session_start",
  UserPromptSubmit: "user_prompt_submit",
  PreToolUse: "tool_call_start",
  PostToolUse: "tool_call_end",
  PermissionRequest: "permission_request",
  Stop: "stop"
};

const KIRO_EVENTS: Record<string, string> = {
  agentSpawn: "session_start",
  userPromptSubmit: "user_prompt_submit",
  preToolUse: "tool_call_start",
  postToolUse: "tool_call_end",
  stop: "stop"
};

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

function installedCount(root: JsonObject, events: Record<string, string>, source: HookAgentId): number {
  const hooks = isObject(root.hooks) ? root.hooks : {};
  return Object.entries(events).filter(([hookName, event]) =>
    commandsIn(hooks[hookName]).includes(commandFor(event, source))
  ).length;
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

function mergeCodexHooks(root: JsonObject): number {
  const hooks = hooksObject(root);
  let added = 0;

  for (const [hookName, event] of Object.entries(CODEX_EVENTS)) {
    const entries = eventEntries(hooks, hookName);
    const command = commandFor(event, "codex");
    if (!commandsIn(entries).includes(command)) {
      entries.push({
        matcher: "*",
        hooks: [{ type: "command", command, timeout: 5 }]
      });
      added += 1;
    }
    hooks[hookName] = entries;
  }
  return added;
}

function mergeKiroHooks(root: JsonObject): number {
  const hooks = hooksObject(root);
  let added = 0;

  for (const [hookName, event] of Object.entries(KIRO_EVENTS)) {
    const entries = eventEntries(hooks, hookName);
    const command = commandFor(event, "kiro");
    if (!commandsIn(entries).includes(command)) {
      entries.push({
        ...(hookName === "preToolUse" || hookName === "postToolUse" ? { matcher: "*" } : {}),
        command,
        description: "Sync agent state to Dango"
      });
      added += 1;
    }
    hooks[hookName] = entries;
  }
  return added;
}

async function targetFor(filePath: string, events: Record<string, string>, source: HookAgentId): Promise<HookTarget> {
  try {
    const root = await readJson(filePath);
    return {
      id: path.basename(filePath),
      name: typeof root.name === "string" ? root.name : path.basename(filePath),
      path: filePath,
      installed: installedCount(root, events, source),
      total: Object.keys(events).length,
      writable: await isWritable(filePath)
    };
  } catch (error) {
    return {
      id: path.basename(filePath),
      name: path.basename(filePath, ".json"),
      path: filePath,
      installed: 0,
      total: Object.keys(events).length,
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
      targets: [await targetFor(CODEX_PATH, CODEX_EVENTS, "codex")]
    },
    {
      id: "kiro",
      name: "Kiro CLI",
      description: "Choose Kiro agent files and append hooks without changing existing commands.",
      path: KIRO_DIR,
      targets: await Promise.all(kiroFiles.map((filePath) => targetFor(filePath, KIRO_EVENTS, "kiro")))
    }
  ];
}

export async function installAgentHooks(request: HookInstallRequest): Promise<HookInstallResult> {
  const errors: string[] = [];
  let changedFiles = 0;
  let addedHooks = 0;

  if (request.agent === "codex") {
    try {
      const root = await readJson(CODEX_PATH);
      const added = mergeCodexHooks(root);
      if (added > 0) {
        await atomicWriteJson(CODEX_PATH, root);
        changedFiles += 1;
        addedHooks += added;
      }
    } catch (error) {
      errors.push(`${CODEX_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (request.agent === "kiro") {
    const allowed = new Set(
      (await readdir(KIRO_DIR, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
    );
    const selected = request.targetIds ?? [];
    for (const targetId of selected) {
      if (!allowed.has(targetId)) {
        errors.push(`${targetId}: file is not a Kiro agent configuration`);
        continue;
      }
      const filePath = path.join(KIRO_DIR, targetId);
      try {
        const root = await readJson(filePath);
        const added = mergeKiroHooks(root);
        if (added > 0) {
          await atomicWriteJson(filePath, root);
          changedFiles += 1;
          addedHooks += added;
        }
      } catch (error) {
        errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    changedFiles,
    addedHooks,
    errors,
    agents: await inspectAgentHooks()
  };
}
