import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { AgentSource, CompanionConfig, DeviceCommand, FACES, INDICATORS, DISPLAY_POWERS, HookInstallRequest, isAgentEvent } from "../src/shared/protocol.js";
import { AppState } from "./state.js";
import { inspectAgentHooks, installAgentHooks } from "./agents.js";

interface DesktopControls {
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendCommand: (command: DeviceCommand) => Promise<void>;
  updateConfig: (patch: Partial<CompanionConfig>) => Promise<void>;
  syncDisplaySchedule: () => Promise<void>;
  syncIdleTimeout: () => Promise<void>;
}

export class WebhookServer {
  private server: FastifyInstance | null = null;

  constructor(
    private readonly state: AppState,
    private readonly controls?: DesktopControls
  ) {}

  async start(port: number): Promise<void> {
    if (this.server) await this.stop();

    const server = Fastify({ logger: false });
    await server.register(cors, { origin: true });

    const handle = (eventRaw: unknown, sourceRaw: unknown) => {
      if (!isAgentEvent(eventRaw)) {
        return { success: false, error: "Invalid event" };
      }
      const source: AgentSource = typeof sourceRaw === "string" && sourceRaw.length > 0 ? sourceRaw : "unknown";
      const message = this.state.handleAgentEvent(eventRaw, source);
      return { success: true, face: message.command.face };
    };

    server.post<{ Body: { event?: unknown; source?: unknown } }>("/hook", async (request, reply) => {
      const result = handle(request.body?.event, request.body?.source);
      if (!result.success) reply.code(400);
      return result;
    });

    server.get<{ Querystring: { event?: unknown; source?: unknown } }>("/hook", async (request, reply) => {
      const result = handle(request.query.event, request.query.source);
      if (!result.success) reply.code(400);
      return result;
    });

    server.get("/health", async () => ({ ok: true }));

    // Local UI API: lets a browser-hosted Vite renderer talk to the real
    // Electron main process when preload IPC is not available.
    server.get("/api/snapshot", async () => this.state.snapshot());

    server.get("/api/agents", async () => inspectAgentHooks());

    server.post<{ Body: HookInstallRequest }>("/api/agents/install", async (request, reply) => {
      if (request.body?.agent !== "codex" && request.body?.agent !== "kiro") {
        reply.code(400);
        return { success: false, error: "Invalid agent" };
      }
      return installAgentHooks(request.body);
    });

    server.post<{ Body: Partial<CompanionConfig> }>("/api/config", async (request) => {
      await this.controls?.updateConfig(request.body ?? {});
      return this.state.snapshot();
    });

    server.post("/api/ble/reconnect", async () => {
      await this.controls?.reconnect();
      return this.state.snapshot();
    });

    server.post("/api/ble/disconnect", async () => {
      await this.controls?.disconnect();
      return this.state.snapshot();
    });

    server.post("/api/settings/schedule", async () => {
      await this.controls?.syncDisplaySchedule();
      return this.state.snapshot();
    });

    server.post("/api/settings/idle-timeout", async () => {
      await this.controls?.syncIdleTimeout();
      return this.state.snapshot();
    });

    server.post<{ Body: { face?: unknown; indicator?: unknown; display?: unknown } }>("/api/command", async (request, reply) => {
      const body = request.body as Record<string, unknown> | undefined;
      const face = body?.face;
      const indicator = body?.indicator;
      const display = body?.display;
      if (
        (face !== undefined && !FACES.includes(face as any)) ||
        (indicator !== undefined && !INDICATORS.includes(indicator as any)) ||
        (display !== undefined && !DISPLAY_POWERS.includes(display as any))
      ) {
        reply.code(400);
        return { success: false, error: "Invalid command" };
      }
      const command: DeviceCommand = {
        face: (face as any) ?? this.state.currentCommand.face,
        indicator: (indicator as any) ?? this.state.currentCommand.indicator,
        display: (display as any) ?? this.state.currentCommand.display
      };
      await this.controls?.sendCommand(command);
      return this.state.snapshot();
    });

    await server.listen({ host: "127.0.0.1", port });
    this.server = server;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await this.server.close();
    this.server = null;
  }
}
