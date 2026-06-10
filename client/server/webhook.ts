import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { AgentSource, CompanionConfig, Expression, EXPRESSIONS, HookInstallRequest, isAgentEvent } from "../src/shared/protocol.js";
import { AppState } from "./state.js";
import { inspectAgentHooks, installAgentHooks } from "./agents.js";

interface DesktopControls {
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendExpression: (expression: Expression) => Promise<void>;
  updateConfig: (patch: Partial<CompanionConfig>) => Promise<void>;
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
      this.state.handleAgentEvent(eventRaw, source);
      return { success: true };
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

    server.post<{ Body: { expression?: unknown } }>("/api/expression", async (request, reply) => {
      const expression = request.body?.expression;
      if (typeof expression !== "string" || !(expression in EXPRESSIONS)) {
        reply.code(400);
        return { success: false, error: "Invalid expression" };
      }
      await this.controls?.sendExpression(expression as Expression);
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
