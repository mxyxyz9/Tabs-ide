import * as FS from "node:fs/promises";
import * as Os from "node:os";
import * as Path from "node:path";
import {
  type BrowserImportInput,
  type BrowserImportResult,
  type BrowserImportSource,
  type BrowserImportSourceId,
  type BrowserImportSourceProfile,
  type BrowserImportUnavailableReason,
} from "@tabs/contracts";
import { session as electronSession } from "electron";
import { normalizeBrowserProfileId } from "../browserHostManager";

interface BrowserSourceConfig {
  readonly id: BrowserImportSourceId;
  readonly name: string;
  readonly processNames: readonly string[];
  readonly getUserDataDir: (platform: NodeJS.Platform) => string | null;
}

const BROWSER_CONFIGS: readonly BrowserSourceConfig[] = [
  {
    id: "chrome",
    name: "Google Chrome",
    processNames: ["Google Chrome", "chrome", "chrome.exe"],
    getUserDataDir: (platform) => {
      const home = Os.homedir();
      if (platform === "darwin") {
        return Path.join(home, "Library/Application Support/Google/Chrome");
      }
      if (platform === "win32") {
        return Path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/User Data");
      }
      return Path.join(home, ".config/google-chrome");
    },
  },
  {
    id: "brave",
    name: "Brave",
    processNames: ["Brave Browser", "brave", "brave.exe"],
    getUserDataDir: (platform) => {
      const home = Os.homedir();
      if (platform === "darwin") {
        return Path.join(home, "Library/Application Support/BraveSoftware/Brave-Browser");
      }
      if (platform === "win32") {
        return Path.join(process.env.LOCALAPPDATA || "", "BraveSoftware/Brave-Browser/User Data");
      }
      return Path.join(home, ".config/BraveSoftware/Brave-Browser");
    },
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    processNames: ["Microsoft Edge", "msedge", "msedge.exe"],
    getUserDataDir: (platform) => {
      const home = Os.homedir();
      if (platform === "darwin") {
        return Path.join(home, "Library/Application Support/Microsoft Edge");
      }
      if (platform === "win32") {
        return Path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/User Data");
      }
      return Path.join(home, ".config/microsoft-edge");
    },
  },
  {
    id: "firefox",
    name: "Mozilla Firefox",
    processNames: ["firefox", "firefox.exe"],
    getUserDataDir: (platform) => {
      const home = Os.homedir();
      if (platform === "darwin") {
        return Path.join(home, "Library/Application Support/Firefox/Profiles");
      }
      if (platform === "win32") {
        return Path.join(process.env.APPDATA || "", "Mozilla/Firefox/Profiles");
      }
      return Path.join(home, ".mozilla/firefox");
    },
  },
  {
    id: "safari",
    name: "Safari",
    processNames: ["Safari"],
    getUserDataDir: (platform) => {
      if (platform !== "darwin") return null;
      return Path.join(Os.homedir(), "Library/Containers/com.apple.Safari/Data/Library/Cookies");
    },
  },
];

export class BrowserSessionImporter {
  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly isProcessRunningFn: (
      processNames: readonly string[],
    ) => Promise<boolean> = isProcessRunningDefault,
  ) {}

  async listSources(): Promise<BrowserImportSource[]> {
    const sources: BrowserImportSource[] = [];

    for (const config of BROWSER_CONFIGS) {
      const userDataDir = config.getUserDataDir(this.platform);
      if (!userDataDir) {
        continue;
      }

      let installed = false;
      try {
        const stat = await FS.stat(userDataDir);
        installed = stat.isDirectory();
      } catch {
        installed = false;
      }

      if (!installed) {
        continue;
      }

      const running = await this.isProcessRunningFn(config.processNames);
      let unavailable: BrowserImportUnavailableReason | undefined;
      if (running) {
        unavailable = "browserRunning";
      } else {
        // Source discovery is retained for the settings UI, but the engine-
        // specific cookie readers have not been ported yet. Keep import
        // disabled instead of presenting a control that cannot do its job.
        unavailable = "unsupportedPlatform";
      }

      const profiles = await this.discoverProfiles(config.id, userDataDir);

      sources.push({
        id: config.id,
        name: config.name,
        profiles,
        unavailable,
      });
    }

    return sources;
  }

  private async discoverProfiles(
    sourceId: BrowserImportSourceId,
    userDataDir: string,
  ): Promise<BrowserImportSourceProfile[]> {
    if (sourceId === "safari") {
      return [
        {
          directory: "Default",
          name: "Default Profile",
        },
      ];
    }

    try {
      const entries = await FS.readdir(userDataDir, { withFileTypes: true });
      const profiles: BrowserImportSourceProfile[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirName = entry.name;
        if (dirName === "Default") {
          profiles.push({
            directory: "Default",
            name: "Default Profile",
          });
        } else if (dirName.startsWith("Profile ") || dirName.includes(".default")) {
          profiles.push({
            directory: dirName,
            name: dirName,
          });
        }
      }

      if (profiles.length === 0) {
        profiles.push({
          directory: "Default",
          name: "Default Profile",
        });
      }

      return profiles;
    } catch {
      return [
        {
          directory: "Default",
          name: "Default Profile",
        },
      ];
    }
  }

  async importSelectedCookies(input: BrowserImportInput): Promise<BrowserImportResult> {
    const targetProfileId = normalizeBrowserProfileId(input.targetProfileId);
    const config = BROWSER_CONFIGS.find((c) => c.id === input.sourceId);
    if (!config) {
      throw new Error(`Unknown browser source: ${input.sourceId}`);
    }

    const running = await this.isProcessRunningFn(config.processNames);
    if (running) {
      throw new Error(
        "Please quit the browser first so its cookie database can be safely read without lock contention.",
      );
    }

    const userDataDir = config.getUserDataDir(this.platform);
    if (!userDataDir) {
      throw new Error(`Browser source ${input.sourceId} is not supported on this platform.`);
    }

    const profiles = await this.discoverProfiles(config.id, userDataDir);
    if (!profiles.some((profile) => profile.directory === input.sourceProfileDirectory)) {
      throw new Error("Selected browser profile was not found.");
    }

    const partition = `persist:tabs-browser:profile:${targetProfileId}`;
    const targetSession = electronSession.fromPartition(partition);

    // Resolve only the cookie store belonging to the validated profile. Passwords,
    // history, and autofill are never accessed.
    const cookieDbPath =
      config.id === "firefox"
        ? Path.join(userDataDir, input.sourceProfileDirectory, "cookies.sqlite")
        : config.id === "safari"
          ? Path.join(userDataDir, "Cookies.binarycookies")
          : Path.join(userDataDir, input.sourceProfileDirectory, "Cookies");
    let fileExists = false;
    try {
      const stat = await FS.stat(cookieDbPath);
      fileExists = stat.isFile();
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      throw new Error("No readable cookie database was found for the selected browser profile.");
    }

    // Cookie extraction requires each browser engine's native decryption and
    // database handling. Do not report success until that implementation has
    // actually populated the Electron partition.
    void targetSession;
    throw new Error(
      "Cookie import for this browser is not available yet. No browser data was changed.",
    );
  }
}

async function isProcessRunningDefault(processNames: readonly string[]): Promise<boolean> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("tasklist", ["/FO", "CSV"]);
      return processNames.some((name) => stdout.toLowerCase().includes(name.toLowerCase()));
    }

    const { stdout } = await execFileAsync("pgrep", ["-f", processNames[0] || ""]);
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}
