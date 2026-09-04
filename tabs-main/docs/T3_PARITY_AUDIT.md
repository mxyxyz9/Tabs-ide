# T3 Code parity audit

Scope: port non-mobile T3 Code capabilities into Tabs while retaining Tabs implementations that
are already stronger. This is a live implementation ledger; a checked item requires source and
verification evidence, not just a matching type or placeholder.

## Environments and connections

- [x] Persistent environment identity, pairing, bearer sessions, proof-bound sessions, and
      WebSocket tickets.
- [x] SSH discovery, managed remote startup, tunnels, pairing, and desktop environment catalog.
- [x] Renderer connection settings create, list, reconnect, and remove remote environments.
- [x] Saved direct and SSH environments can be activated, mint authenticated WebSocket tickets,
      and renew those tickets after disconnects or system resume.
- [ ] Route each project/thread runtime through its selected environment instead of the current
      process-wide transport.
- [x] Scope environment routes, read-model hydration, chat commands, Git operations, code-file
      queries, and command-palette workspace browsing/project creation to the selected environment.
- [x] Surface direct/SSH/Tailscale reachability and connection repair in settings.
- [ ] Add managed cloud relay account discovery and status to the main workspace.
- [x] Replace the native SSH password prompt with an accessible in-app credential dialog.

## Collaborative browser and computer use

- [x] Server preview-session synchronization and automation request broker.
- [x] Authenticated WebSocket broker channels for host registration, focus, requests, and replies.
- [x] Tabs persistent browser host with isolated profiles, login windows, navigation, and DevTools.
- [x] Adapt the broker host protocol to Tabs' `WebContentsView` browser sessions.
- [x] Implement accessibility snapshots and click/type/press/scroll/evaluate/wait operations in
      the browser host.
- [x] Route automation viewport changes through the same persistent per-session state as human
      controls, including fill, freeform, named Chrome-device presets, orientation, and measured
      guest-viewport readiness.
- [x] Populate automation snapshots with bounded live console, network, and action diagnostics
      instead of placeholder arrays.
- [x] Report real native URL/title/loading/history/failure changes back to the authoritative
      preview session, including redirects and human navigation.
- [x] Serialize native automation actions, surface agent/human control in browser chrome, render
      agent click position inside the guest, and let real human keyboard/mouse input interrupt
      stale agent actions through a control epoch.
- [x] Capture browser screenshots as real managed artifacts, with typed renderer IPC and
      artifact-directory-restricted reveal/copy operations.
- [x] Record the live Chromium guest through its native media-source ID and persist non-empty
      recording bytes as managed artifacts through the automation broker.
- [x] Add a native element picker with hover targeting, Escape cancellation, selector/HTML/style
      context, element bounds, screenshot capture, and direct composer attachment.
- [x] Persist picked preview context, render removable accessible composer cards, include the real
      screenshot through the production image path, validate the expanded provider prompt, and
      restore annotation state after failed dispatch.
- [x] Add a screenshot-coordinate annotation editor for pointer and keyboard-authored regions,
      ink strokes, real-element style changes, and comments, then attach the enriched payload
      through the existing composer transport.
- [x] Expose preview automation through the authenticated HTTP MCP transport.

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
- [x] Isolate same-ID projects and threads across renderer read-model mutations, drag identities,
      agent/server/testing/browser UI state, proposed-plan lookup, and persisted sidebar state.
- [ ] Project filesystem/workspace services and environment-aware file operations.
- [x] Provider-scoped MCP credential issuance, liveness refresh, resolution, and revocation.
- [x] HTTP MCP transport lifecycle, provider injection, discovery, and complete preview tool
      exposure.
- [x] Desktop resume events force stale renderer WebSocket transports to reconnect.
- [x] Background activity leases, disconnect cleanup, desktop suspend/lock/battery/thermal
      reporting, configurable power profiles, policy streaming, and demand-gated provider polling.
- [x] Environment process-tree diagnostics, bounded history, safe descendant process signaling,
      and an accessible diagnostics settings panel.
- [ ] Native resource attribution, trace-file aggregation, and support bundles.
- [x] Desktop self-update state machine, download/install actions, sidebar notification, and
      settings UI. Tabs retains its existing updater because it is already more complete.
- [ ] Cloud relay account and managed-server status UI parity.
- [x] Environment-aware themes and appearance synchronization with bounded server-published
      palettes, hot reload, remote theme selection, and retained local custom presets.
- [x] Searchable keyboard-accessible command palette with project, thread, navigation, and action
      submenus. Tabs retains its existing implementation because it is already more complete.
- [x] Enforce the provider contract's 120,000-character turn limit before side effects, preserve
      oversized drafts, disable invalid submissions, and render accessible actionable feedback.
- [ ] Remaining T3 chat actions and in-application documentation surfaces.

Mobile applications and mobile-only protocol/UI work are explicitly excluded.
