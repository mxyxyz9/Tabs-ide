import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  shell: {
    openExternal: vi.fn(async () => undefined),
  },
}));

import { decideWindowOpenAction, isSafePopupProtocol } from "./popupHandoff";

describe("popupHandoff", () => {
  describe("isSafePopupProtocol", () => {
    it("permits only classifiable web URLs", () => {
      expect(isSafePopupProtocol("https://github.com/login/oauth/authorize")).toBe(true);
      expect(isSafePopupProtocol("http://localhost:3000/auth")).toBe(true);
      expect(isSafePopupProtocol("about:blank")).toBe(false);
      expect(isSafePopupProtocol("about:srcdoc")).toBe(false);
    });

    it("rejects dangerous or privileged protocols", () => {
      expect(isSafePopupProtocol("javascript:alert(1)")).toBe(false);
      expect(isSafePopupProtocol("file:///etc/passwd")).toBe(false);
      expect(isSafePopupProtocol("data:text/html,hack")).toBe(false);
      expect(isSafePopupProtocol("chrome://settings")).toBe(false);
    });
  });

  describe("decideWindowOpenAction", () => {
    const testPartition = "persist:tabs-browser:profile:work";

    it("denies unclassifiable about:blank bootstrap popups", () => {
      const decision = decideWindowOpenAction(
        {
          url: "about:blank",
          disposition: "new-window",
          frameName: "auth_popup",
          features: "width=600,height=700",
          referrer: { url: "https://my-app.com", policy: "strict-origin" },
          postBody: null as never,
        },
        testPartition,
        "https://my-app.com",
      );

      expect(decision.action).toBe("deny");
    });

    it("allows scripted OAuth popups sharing the exact session partition", () => {
      const decision = decideWindowOpenAction(
        {
          url: "https://github.com/login/oauth/authorize?client_id=xyz",
          disposition: "new-window",
          frameName: "oauth",
          features: "width=500,height=600",
          referrer: { url: "https://my-app.com", policy: "strict-origin" },
          postBody: null as never,
        },
        testPartition,
        "https://my-app.com",
      );

      expect(decision.action).toBe("allow");
      if (decision.action === "allow") {
        expect(decision.overrideBrowserWindowOptions.webPreferences?.partition).toBe(testPartition);
      }
    });

    it("requires an explicit user action for providers that reject embedding", () => {
      const decision = decideWindowOpenAction(
        {
          url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=xyz",
          disposition: "new-window",
          frameName: "oauth",
          features: "width=500,height=600",
          referrer: { url: "https://my-app.com", policy: "strict-origin" },
          postBody: null as never,
        },
        testPartition,
        "https://my-app.com",
      );

      expect(decision).toEqual({ action: "deny", externalOAuthRequired: true });
    });

    it("routes plain target=_blank links to external browser", () => {
      const decision = decideWindowOpenAction(
        {
          url: "https://docs.github.com/en",
          disposition: "foreground-tab",
          frameName: "",
          features: "",
          referrer: { url: "https://my-app.com", policy: "strict-origin" },
          postBody: null as never,
        },
        testPartition,
        "https://my-app.com",
      );

      expect(decision.action).toBe("deny");
      if (decision.action === "deny") {
        expect(decision.handledExternally).toBe(true);
      }
    });

    it("routes unclassified scripted popups externally without sharing the partition", () => {
      const decision = decideWindowOpenAction(
        {
          url: "https://ads.example.com/popup",
          disposition: "new-window",
          frameName: "advertisement",
          features: "width=500,height=600",
          referrer: { url: "https://my-app.com", policy: "strict-origin" },
          postBody: null as never,
        },
        testPartition,
        "https://my-app.com",
      );

      expect(decision).toEqual({ action: "deny" });
    });

    it("denies unsafe protocols", () => {
      const decision = decideWindowOpenAction(
        {
          url: "javascript:void(0)",
          disposition: "new-window",
          frameName: "",
          features: "",
          referrer: { url: "https://my-app.com", policy: "strict-origin" },
          postBody: null as never,
        },
        testPartition,
        "https://my-app.com",
      );

      expect(decision.action).toBe("deny");
    });
  });

  describe("simulated postMessage OAuth completion handoff", () => {
    interface MessageEventPayload {
      readonly origin: string;
      readonly data: { type: string; token?: string; error?: string };
    }

    it("accepts postMessage from matching provider origin", () => {
      const allowedOrigin = "https://accounts.google.com";
      const onMessage = vi.fn();

      const handleMessage = (event: MessageEventPayload) => {
        if (event.origin !== allowedOrigin) return;
        if (event.data?.type === "oauth-complete") {
          onMessage(event.data);
        }
      };

      handleMessage({
        origin: allowedOrigin,
        data: { type: "oauth-complete", token: "valid_jwt" },
      });

      expect(onMessage).toHaveBeenCalledWith({
        type: "oauth-complete",
        token: "valid_jwt",
      });
    });

    it("rejects postMessage from wrong or attacker origin", () => {
      const allowedOrigin = "https://accounts.google.com";
      const onMessage = vi.fn();

      const handleMessage = (event: MessageEventPayload) => {
        if (event.origin !== allowedOrigin) return;
        onMessage(event.data);
      };

      handleMessage({
        origin: "https://evil-attacker.com",
        data: { type: "oauth-complete", token: "stolen" },
      });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });
});
