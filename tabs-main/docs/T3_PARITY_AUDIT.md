# T3 Code parity audit

Scope: port non-mobile T3 Code capabilities into Tabs while retaining Tabs implementations that
are already stronger. This is a live implementation ledger; a checked item requires source and
verification evidence, not just a matching type or placeholder.

## Environments and connections

- [x] Persistent environment identity, pairing, bearer sessions, proof-bound sessions, and
      WebSocket tickets.
- [x] SSH discovery, managed remote startup, tunnels, pairing, and desktop environment catalog.
- [x] Renderer connection settings create, list, reconnect, and remove remote environments.
- [ ] Route each project/thread runtime through its selected environment instead of the current
      process-wide transport.
- [ ] Surface relay/Tailscale reachability and connection repair in the main workspace.
- [ ] Replace the native SSH password prompt with an accessible in-app credential dialog.

## Collaborative browser and computer use

- [x] Server preview-session synchronization and automation request broker.
- [x] Authenticated WebSocket broker channels for host registration, focus, requests, and replies.
- [x] Tabs persistent browser host with isolated profiles, login windows, navigation, and DevTools.
- [ ] Adapt the broker host protocol to Tabs' `WebContentsView` browser sessions.
- [ ] Implement accessibility snapshots and click/type/press/scroll/evaluate/wait operations in
      the browser host.
- [ ] Synchronize URL, navigation, viewport, cursor, and human-input ownership between clients.
- [ ] Add annotation picking, screenshots, recordings, and artifact reveal/copy.
- [ ] Expose the preview automation operations through the MCP server.

Tabs deliberately keeps `WebContentsView` rather than replacing it with T3's `<webview>` engine;
it already provides stronger persistent profiles and session switching. Parity is implemented as
an adapter over that engine.

## Thread workflow

- [x] Server-persisted settle, unsettle, snooze, wake, pin, unpin, and pin ordering events.
- [x] Projection migrations, upgrade catch-up, snapshots, and renderer hydration.
- [x] Sidebar, Agents workspace, and composer use server lifecycle commands.
- [x] New user work wakes settled and snoozed threads.
- [x] Enforce pending-approval, pending-input, and queued-turn guards for settle/snooze.
- [x] Server-side latest-message, pending-request, and actionable-plan summary counters.
- [x] Automatic wake behavior for new turns, active sessions, approvals, and user input.
- [x] T3 snooze presets in the desktop thread context menu.
- [x] Persisted, keyboard-accessible Move Up/Down ordering for pinned threads.
- [x] Pointer drag ordering for pinned threads.
- [x] Title regeneration worker, interruption recovery, correlation, and sidebar action.
- [x] Linked pull-request metadata command, projection, persistence, and hydration.
- [x] Automatically discover/update linked pull requests and render their shared status.

## Remaining non-mobile systems

- [ ] Multi-environment renderer state and environment-scoped queries/mutations.
- [ ] Project filesystem/workspace services and environment-aware file operations.
- [ ] HTTP MCP server lifecycle, discovery, authorization, and complete tool exposure.
- [ ] Background liveness, sleep/wake recovery, and desktop power handling.
- [ ] Resource telemetry, diagnostics, tracing UI, and support bundles.
- [ ] Self-update and cloud/relay status UI parity.
- [ ] Environment-aware themes and appearance synchronization.
- [ ] Remaining chat actions, command palette parity, voice input, and documentation surfaces.

Mobile applications and mobile-only protocol/UI work are explicitly excluded.
