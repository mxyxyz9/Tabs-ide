import type { GitEnvironmentResult, NativeApi } from "@tabs/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import "../../index.css";
import { GitEnvironmentGate } from "./GitEnvironmentGate";
import { GitApiProvider } from "./gitApiContext";
import { DeviceAuthModal, DiscardAllModal, ForcePushModal } from "./gitModals";

const environment = (authenticated: boolean): GitEnvironmentResult => ({
  git: { installed: true, version: "2.52.0" },
  gitHub: {
    cliInstalled: true,
    version: "2.80.0",
    authenticated,
    accounts: [],
    activeLogin: null,
  },
});

async function mount(content: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const screen = await render(content, { container: host });
  return {
    [Symbol.asyncDispose]: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

function authApi(authenticated: boolean): NativeApi {
  return {
    git: {
      environment: vi.fn().mockResolvedValue(environment(authenticated)),
    },
  } as unknown as NativeApi;
}

describe("Git workflow interaction states", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("blocks the workspace during loading and initializes an empty repository", async () => {
    const initialize = vi.fn();
    const { rerender, unmount } = await render(
      <GitEnvironmentGate
        environment={undefined}
        isRepo={undefined}
        isLoading
        initPending={false}
        onInitRepo={initialize}
      >
        <div>Repository workspace</div>
      </GitEnvironmentGate>,
    );

    expect(document.body.textContent).not.toContain("Repository workspace");

    await rerender(
      <GitEnvironmentGate
        environment={environment(false)}
        isRepo={false}
        isLoading={false}
        initPending={false}
        onInitRepo={initialize}
      >
        <div>Repository workspace</div>
      </GitEnvironmentGate>,
    );
    await page.getByRole("button", { name: "Initialize repository" }).click();
    expect(initialize).toHaveBeenCalledOnce();
    await unmount();
  });

  it("requires explicit confirmation for destructive operations", async () => {
    const discard = vi.fn();
    const forcePush = vi.fn();

    {
      await using _ = await mount(
        <DiscardAllModal count={3} onConfirm={discard} onClose={vi.fn()} />,
      );
      expect(document.body.textContent).toContain("This discards 3 files");
      await page.getByRole("button", { name: "Discard everything" }).click();
      expect(discard).toHaveBeenCalledOnce();
    }

    {
      await using _ = await mount(
        <ForcePushModal branch="feature/demo" onConfirm={forcePush} onClose={vi.fn()} />,
      );
      expect(document.body.textContent).toContain("This overwrites the remote branch");
      await page.getByRole("button", { name: "Force push anyway" }).click();
      expect(forcePush).toHaveBeenCalledOnce();
    }
  });

  it("keeps authentication open until the provider reports success", async () => {
    const confirmed = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await using _ = await mount(
      <QueryClientProvider client={queryClient}>
        <GitApiProvider api={authApi(false)} scopeKey="test">
          <DeviceAuthModal
            cwd="/workspace"
            onRunGitHubLogin={vi.fn()}
            onConfirm={confirmed}
            onClose={vi.fn()}
          />
        </GitApiProvider>
      </QueryClientProvider>,
    );

    await page.getByRole("button", { name: "I've authorized it" }).click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("GitHub is not authenticated yet");
    });
    expect(confirmed).not.toHaveBeenCalled();
  });
});
