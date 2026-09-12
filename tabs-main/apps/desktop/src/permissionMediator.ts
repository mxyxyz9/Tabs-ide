/**
 * Permission and Capability Mediation for Embedded Browser Sessions.
 *
 * Implements strict, origin-aware permission mediation to protect user privacy
 * and security while enabling 2FA, QR code scanning, and passkey/WebAuthn flows.
 *
 * Core principles:
 * 1. Safe minimum permissions (clipboard, notifications, pointerLock) granted automatically.
 * 2. High-risk permissions (camera, microphone, USB, HID, serial, local-fonts) NEVER silently granted.
 * 3. Secure context verification for WebAuthn/Passkey flows with external fallback guidance.
 * 4. Origin isolation: decisions for one origin never bleed into another.
 */

export type PermissionCategory =
  | "safe_allowed"
  | "high_risk_media"
  | "high_risk_hardware"
  | "high_risk_privacy"
  | "external_challenge"
  | "denied_unknown";

export interface PermissionDetails {
  readonly requestingUrl?: string | undefined;
  readonly isMainFrame?: boolean | undefined;
  readonly securityOrigin?: string | undefined;
  readonly mediaType?: "video" | "audio" | undefined;
  readonly externalURL?: string | undefined;
}

export interface WebAuthnSupportCheck {
  readonly supported: boolean;
  readonly isSecureContext: boolean;
  readonly fallbackRequired: boolean;
  readonly reason: string;
}

const SAFE_PERMISSIONS = new Set([
  "clipboard-read",
  "clipboard-sanitized-write",
  "pointerLock",
  "notifications",
  "fullscreen",
]);

const HIGH_RISK_MEDIA = new Set(["media", "camera", "microphone"]);
const HIGH_RISK_HARDWARE = new Set(["usb", "hid", "serial", "midi", "midiSysex"]);
const HIGH_RISK_PRIVACY = new Set(["local-fonts", "display-capture", "geolocation"]);

export function categorizePermission(
  permission: string,
  _details?: PermissionDetails,
): PermissionCategory {
  if (SAFE_PERMISSIONS.has(permission)) {
    return "safe_allowed";
  }
  if (HIGH_RISK_MEDIA.has(permission)) {
    return "high_risk_media";
  }
  if (HIGH_RISK_HARDWARE.has(permission)) {
    return "high_risk_hardware";
  }
  if (HIGH_RISK_PRIVACY.has(permission)) {
    return "high_risk_privacy";
  }
  if (permission === "openExternal") {
    return "external_challenge";
  }
  return "denied_unknown";
}

export function extractOriginFromUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    return parsed.origin;
  } catch {
    return "";
  }
}

export function isSecureWebContext(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") return true;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks whether WebAuthn / Passkeys can be reliably invoked in the given context.
 * WebAuthn requires a secure origin (HTTPS or localhost). Non-secure HTTP origins
 * cause Chromium to abort with SecurityError.
 */
export function checkWebAuthnContext(rawUrl: string): WebAuthnSupportCheck {
  const secure = isSecureWebContext(rawUrl);
  if (!secure) {
    return {
      supported: false,
      isSecureContext: false,
      fallbackRequired: true,
      reason:
        "WebAuthn and passkeys require an HTTPS origin or localhost. Embedded HTTP sessions must use the system browser.",
    };
  }
  return {
    supported: true,
    isSecureContext: true,
    fallbackRequired: false,
    reason: "Secure context available for WebAuthn credentials.",
  };
}

export class PermissionMediator {
  private readonly rememberedDecisions = new Map<string, Map<string, boolean>>();

  /**
   * Evaluates an incoming permission request from a WebContents instance.
   */
  evaluateRequest(
    permission: string,
    requestingUrl: string | undefined,
    details?: PermissionDetails,
  ): boolean {
    const category = categorizePermission(permission, details);

    // Safe permissions are granted automatically
    if (category === "safe_allowed") {
      return true;
    }

    const origin = extractOriginFromUrl(requestingUrl || details?.securityOrigin);
    if (!origin) {
      return false;
    }

    // Check if user explicitly allowed this permission for this origin
    const originDecisions = this.rememberedDecisions.get(origin);
    if (originDecisions?.has(permission)) {
      return originDecisions.get(permission) ?? false;
    }

    // High risk permissions (camera, microphone, hardware, privacy) are NEVER silently granted
    return false;
  }

  /**
   * Synchronous check handler (e.g. navigator.permissions.query).
   */
  evaluateCheck(permission: string, requestingOrigin: string): boolean {
    const category = categorizePermission(permission);
    if (category === "safe_allowed") {
      return true;
    }
    const originDecisions = this.rememberedDecisions.get(requestingOrigin);
    return originDecisions?.get(permission) ?? false;
  }

  /**
   * Grants or denies a specific permission for an origin (e.g. after user prompt).
   */
  recordDecision(origin: string, permission: string, granted: boolean): void {
    if (!origin) return;
    let decisions = this.rememberedDecisions.get(origin);
    if (!decisions) {
      decisions = new Map();
      this.rememberedDecisions.set(origin, decisions);
    }
    decisions.set(permission, granted);
  }

  /**
   * Clears remembered decisions for one origin, or all origins if omitted.
   */
  clearDecisions(origin?: string): void {
    if (origin) {
      this.rememberedDecisions.delete(origin);
    } else {
      this.rememberedDecisions.clear();
    }
  }

  hasRememberedDecision(origin: string, permission: string): boolean {
    return this.rememberedDecisions.get(origin)?.has(permission) ?? false;
  }
}
