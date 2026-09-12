import { describe, expect, it, beforeEach } from "vitest";
import {
  PermissionMediator,
  categorizePermission,
  checkWebAuthnContext,
  extractOriginFromUrl,
  isSecureWebContext,
} from "./permissionMediator";

describe("permissionMediator", () => {
  let mediator: PermissionMediator;

  beforeEach(() => {
    mediator = new PermissionMediator();
  });

  describe("categorizePermission", () => {
    it("recognizes safe allowed permissions", () => {
      expect(categorizePermission("clipboard-read")).toBe("safe_allowed");
      expect(categorizePermission("clipboard-sanitized-write")).toBe("safe_allowed");
      expect(categorizePermission("notifications")).toBe("safe_allowed");
      expect(categorizePermission("pointerLock")).toBe("safe_allowed");
      expect(categorizePermission("fullscreen")).toBe("safe_allowed");
    });

    it("recognizes high-risk media permissions", () => {
      expect(categorizePermission("camera")).toBe("high_risk_media");
      expect(categorizePermission("microphone")).toBe("high_risk_media");
      expect(categorizePermission("media")).toBe("high_risk_media");
    });

    it("recognizes high-risk hardware and privacy permissions", () => {
      expect(categorizePermission("usb")).toBe("high_risk_hardware");
      expect(categorizePermission("hid")).toBe("high_risk_hardware");
      expect(categorizePermission("serial")).toBe("high_risk_hardware");
      expect(categorizePermission("local-fonts")).toBe("high_risk_privacy");
      expect(categorizePermission("display-capture")).toBe("high_risk_privacy");
    });

    it("denies unknown permissions", () => {
      expect(categorizePermission("unknown-permission-xyz")).toBe("denied_unknown");
    });
  });

  describe("PermissionMediator requests and checks", () => {
    const origin = "https://app.example.com";
    const requestUrl = "https://app.example.com/dashboard";

    it("automatically grants safe permissions", () => {
      expect(mediator.evaluateRequest("clipboard-read", requestUrl)).toBe(true);
      expect(mediator.evaluateRequest("clipboard-sanitized-write", requestUrl)).toBe(true);
      expect(mediator.evaluateCheck("clipboard-read", origin)).toBe(true);
    });

    it("never silently grants camera or microphone", () => {
      expect(mediator.evaluateRequest("camera", requestUrl)).toBe(false);
      expect(mediator.evaluateRequest("microphone", requestUrl)).toBe(false);
      expect(mediator.evaluateCheck("camera", origin)).toBe(false);
    });

    it("never silently grants USB, HID, or local fonts", () => {
      expect(mediator.evaluateRequest("usb", requestUrl)).toBe(false);
      expect(mediator.evaluateRequest("hid", requestUrl)).toBe(false);
      expect(mediator.evaluateRequest("local-fonts", requestUrl)).toBe(false);
    });

    it("honors explicitly recorded origin decisions without bleeding across origins", () => {
      mediator.recordDecision(origin, "camera", true);

      // Granted for https://app.example.com
      expect(mediator.evaluateRequest("camera", requestUrl)).toBe(true);
      expect(mediator.evaluateCheck("camera", origin)).toBe(true);

      // NOT granted for https://other-app.com
      const otherOrigin = "https://other-app.com";
      expect(mediator.evaluateRequest("camera", "https://other-app.com/login")).toBe(false);
      expect(mediator.evaluateCheck("camera", otherOrigin)).toBe(false);
    });

    it("clears decisions on demand", () => {
      mediator.recordDecision(origin, "camera", true);
      expect(mediator.evaluateRequest("camera", requestUrl)).toBe(true);

      mediator.clearDecisions(origin);
      expect(mediator.evaluateRequest("camera", requestUrl)).toBe(false);
    });
  });

  describe("WebAuthn context and passkey support verification", () => {
    it("confirms secure contexts for HTTPS origins", () => {
      const check = checkWebAuthnContext("https://github.com/login");
      expect(check.supported).toBe(true);
      expect(check.isSecureContext).toBe(true);
      expect(check.fallbackRequired).toBe(false);
    });

    it("confirms secure contexts for localhost origins", () => {
      const check1 = checkWebAuthnContext("http://localhost:3000/auth");
      expect(check1.supported).toBe(true);
      expect(check1.isSecureContext).toBe(true);

      const check2 = checkWebAuthnContext("http://127.0.0.1:8080/auth");
      expect(check2.supported).toBe(true);
      expect(check2.isSecureContext).toBe(true);
    });

    it("requires external fallback for non-secure HTTP origins", () => {
      const check = checkWebAuthnContext("http://insecure-site.com/auth");
      expect(check.supported).toBe(false);
      expect(check.isSecureContext).toBe(false);
      expect(check.fallbackRequired).toBe(true);
      expect(check.reason).toContain("require an HTTPS origin");
    });
  });

  describe("URL and origin utilities", () => {
    it("extracts origins accurately", () => {
      expect(extractOriginFromUrl("https://login.example.com:8443/oauth/token?foo=bar")).toBe(
        "https://login.example.com:8443",
      );
      expect(extractOriginFromUrl("invalid")).toBe("");
    });

    it("identifies secure contexts correctly", () => {
      expect(isSecureWebContext("https://secure.com")).toBe(true);
      expect(isSecureWebContext("http://localhost:5173")).toBe(true);
      expect(isSecureWebContext("http://127.0.0.1:5173")).toBe(true);
      expect(isSecureWebContext("http://example.com")).toBe(false);
    });
  });
});
