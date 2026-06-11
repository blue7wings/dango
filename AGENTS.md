# AGENTS.md

## Project Overview

Dango is a desktop companion that receives AI agent hook events and sends the
resolved visual state to an ESP32-C3 device over BLE.

The repository has two main targets:

- `client/`: Electron main process, Fastify server, React renderer, and BLE
  client. It uses TypeScript, React, Vite, and npm.
- `esp32/`: ESP32-C3 firmware built with PlatformIO and the Arduino framework.

Keep changes scoped to the target that owns the behavior. When a change affects
the BLE message contract, update and verify both targets.

## Repository Map

- `client/electron/`: Electron lifecycle, preload bridge, and tray behavior.
- `client/server/`: webhook API, application state, configuration, logging,
  agent hook installation, and desktop BLE management.
- `client/src/`: React UI, pages, components, hooks, and renderer services.
- `client/src/shared/protocol.ts`: shared desktop types, event mappings, UUIDs,
  and BLE payload builders.
- `esp32/include/config.h`: firmware hardware and BLE defaults.
- `esp32/src/`: BLE parsing, state machine, display, expressions, scheduling,
  and animation.
- `scripts/dango-codex-hook.sh`: local Codex hook helper.

## Development Commands

Desktop commands run from `client/`:

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run dist
```

Use `npm ci` for a clean install when `package-lock.json` is unchanged. Use
`npm install` when intentionally updating dependencies or the lockfile.

Firmware commands run from `esp32/`:

```bash
pio run
pio run --target upload
pio device monitor
```

Uploading firmware and opening the serial monitor require connected hardware.
Do not treat their absence as a build failure if `pio run` succeeds.

## Implementation Guidelines

- Follow the existing TypeScript strict-mode conventions and preserve ESM
  imports, including `.js` extensions in Electron/server source imports where
  the current code uses them.
- Prefer shared protocol types and helpers over duplicating event, command, or
  BLE payload definitions.
- Keep Electron privileged behavior in the main/preload layers. Do not expose
  Node or Electron APIs directly to the React renderer.
- Keep Fastify route handling thin; state transitions belong in `AppState` or
  the relevant service.
- Preserve the current local-only server defaults (`127.0.0.1:8787`) unless the
  task explicitly changes network exposure.
- In firmware code, avoid blocking work in `loop()`. Integrate ongoing behavior
  through the existing `tick()` pattern.
- Keep firmware allocations and BLE payloads small. Parse structured JSON with
  ArduinoJson rather than manual string slicing.
- Do not change display pin assignments, BLE UUID defaults, or device name on
  only one side of the desktop/firmware boundary.

## Protocol Rules

`client/src/shared/protocol.ts` is the desktop source of truth for agent events,
device commands, and payload construction. Firmware parsing and state enums must
remain compatible with it.

When adding or renaming an event or command value, check all of the following:

- Type unions and mappings in `client/src/shared/protocol.ts`.
- Webhook validation and state handling in `client/server/`.
- UI controls, labels, and previews in `client/src/`.
- BLE parsing and enum conversion in `esp32/src/`.
- Examples and event tables in `README.md`.

Maintain backward compatibility with the documented fallback event payload when
changing BLE parsing, unless removal is explicitly requested.

## Verification

There is currently no automated test suite. Run the checks that match the files
changed:

- Desktop TypeScript/UI/server changes: `cd client && npm run typecheck`.
- Desktop production or Electron changes: `cd client && npm run build`.
- Firmware changes: `cd esp32 && pio run`.
- Cross-boundary protocol changes: run both desktop and firmware builds.

For webhook behavior, use the documented `curl` requests against the local app
and inspect `/api/snapshot` when runtime verification is appropriate.

## Change Discipline

- Keep commits focused and avoid unrelated formatting or generated artifacts.
- Do not commit `client/node_modules/`, build output, PlatformIO output, local
  logs, or machine-specific configuration.
- Update `README.md` when commands, endpoints, supported events, hardware pins,
  BLE defaults, or user-visible setup steps change.
- Preserve existing user changes in a dirty worktree and do not rewrite files
  outside the requested scope.
