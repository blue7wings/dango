# Dango Agent Companion

Dango Agent Companion is a cross-platform desktop app that receives AI Agent hook events and syncs the current state to an ESP32 desk companion over BLE.

The ESP32 renders a low-resolution, character-style face inspired by the original `example` project. The firmware reuses the example hardware defaults for ESP32-C3 Super Mini + ST7789 1.54 inch 240x240 display:

| Signal | ESP32-C3 GPIO |
| --- | --- |
| SDA / MOSI | GPIO 10 |
| SCL / SCK | GPIO 8 |
| RST | GPIO 2 |
| DC | GPIO 1 |
| CS | GPIO 4 |
| BL | GPIO 3 |

## Architecture

```txt
AI Agent Hook
  -> Electron Main Process
  -> Fastify Webhook Server
  -> State Machine
  -> BLE Manager
  -> ESP32 BLE Service
  -> Expression + Animation Engine
  -> ST7789 Display Driver
```

## Project Layout

```txt
client/
  electron/       Electron main, preload, tray
  server/         Webhook, BLE, config, logs, agent config generator
  src/            React UI
esp32/
  include/        Hardware and BLE UUID config
  src/            BLE server, state machine, animation, display driver
scripts/
  dango-codex-hook.sh
```

## BLE UUID Configuration

Defaults are shared by desktop and firmware:

```txt
Device Name: AgentFaceESP32
Service UUID: 7b8f9a10-2f43-4a6f-8b1e-6f4d3c2b1a90
Characteristic UUID: 7b8f9a11-2f43-4a6f-8b1e-6f4d3c2b1a90
```

Change desktop UUIDs in the BLE page. Change firmware UUIDs in `esp32/include/config.h`, then rebuild and upload.

## Desktop Development

```bash
cd client
npm install
npm run dev
```

The webhook server listens on:

```txt
127.0.0.1:8787
```

The Vite renderer dev server uses:

```txt
127.0.0.1:5188
```

Supported endpoints:

```bash
curl -X POST http://127.0.0.1:8787/hook \
  -H 'content-type: application/json' \
  -d '{"event":"tool_use","source":"codex"}'

curl "http://127.0.0.1:8787/hook?event=tool_use&source=codex"
```

## Desktop Build

```bash
cd client
npm run build
npm run dist
```

The Electron app targets macOS, Windows, and Linux through `electron-builder`.

## ESP32 Firmware

Install PlatformIO, connect the ESP32-C3, then run:

```bash
cd esp32
pio run
pio run --target upload
pio device monitor
```

The firmware uses Arduino Framework libraries:

- Adafruit GFX
- Adafruit ST7735 and ST7789
- ArduinoJson
- NimBLE-Arduino

## Event Model

```ts
type AgentEvent =
  | "session_start"
  | "user_prompt_submit"
  | "ai_running"
  | "tool_call_start"
  | "tool_call_end"
  | "tool_use"
  | "tool_done"
  | "permission_request"
  | "error"
  | "stop";
```

Event mapping:

| Event | Expression |
| --- | --- |
| stop | idle |
| session_start | idle |
| user_prompt_submit | working |
| ai_running | working |
| tool_call_start | tool_call_start (yellow indicator) |
| tool_call_end | tool_call_end (indicator off) |
| tool_use | tool_call_start (legacy alias) |
| tool_done | tool_call_end (legacy alias) |
| permission_request | error |
| error | error |

The product exposes only five display states: `idle`, `working`,
`tool_call_start`, `tool_call_end`, and `error`.

State priority is implemented on both desktop and firmware:

```txt
error
tool_call_start
working
tool_call_end
idle
```

`error` stays active until `stop` or `session_start`.

## Codex Integration

Use the included script:

```bash
chmod +x scripts/dango-codex-hook.sh
scripts/dango-codex-hook.sh tool_call_start
```

Generated Codex hook shape:

```json
{
  "hooks": {
    "SessionStart": "dango-hook session_start",
    "UserPromptSubmit": "dango-hook user_prompt_submit",
    "PreToolUse": "dango-hook tool_call_start",
    "PostToolUse": "dango-hook tool_call_end",
    "PermissionRequest": "dango-hook permission_request",
    "Stop": "dango-hook stop"
  }
}
```

The desktop Agents page also generates Cursor, Claude Code, and Kiro CLI starter snippets.

## Cross-Platform Notes

- UI, webhook, tray, and config are portable through Electron.
- BLE uses `@abandonware/noble`; on Linux, BLE access may require BlueZ permissions.
- macOS and Windows may prompt for Bluetooth permission on first scan.
- If BLE native installation fails, install platform build tools and run `npm rebuild @abandonware/noble` inside `client/`.

## Protocol

Primary BLE payload:

```json
{
  "event": "tool_use",
  "expression": "working",
  "source": "codex",
  "timestamp": 1710000000000
}
```

Fallback payload:

```txt
tool_use
```

## Smooth Eye Animation

The firmware uses a lightweight geometry animation engine inspired by the RoboEyes approach, without depending on the GPL-licensed RoboEyes code.

Each eye has a current geometry and a target geometry:

```cpp
struct EyeGeometry {
  float cx;
  float cy;
  float w;
  float h;
  float radius;
};
```

On each animation tick, the current geometry eases toward the target:

```cpp
current.x += (target.x - current.x) * 0.22f;
```

Idle uses the roaming block-eye animation. Working, tool call, and error use fixed block eyes with a shared blink timeline.
