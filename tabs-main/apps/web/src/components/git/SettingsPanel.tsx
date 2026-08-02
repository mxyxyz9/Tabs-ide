import type { GitEnvironmentResult } from "@tabs/contracts";
import { useEffect, useState } from "react";

import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";
import {
  AutoTextarea,
  Card,
  Field,
  SectionLabel,
  TextInput,
} from "./gitPrimitives";

export function updateGitConfigUser(configText: string, newName: string, newEmail: string): string {
  const lines = configText.split(/\r?\n/);
  const resultLines: string[] = [];
  let inUserSection = false;
  let foundUserSection = false;
  let hasName = false;
  let hasEmail = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const sectionName = trimmed.slice(1, -1).trim();
      if (inUserSection) {
        if (!hasName) resultLines.push(`\tname = ${newName}`);
        if (!hasEmail) resultLines.push(`\temail = ${newEmail}`);
      }
      inUserSection = sectionName.toLowerCase() === "user";
      if (inUserSection) {
        foundUserSection = true;
        hasName = false;
        hasEmail = false;
      }
      resultLines.push(line);
      continue;
    }

    if (inUserSection) {
      if (/^name\s*=/i.test(trimmed)) {
        resultLines.push(`\tname = ${newName}`);
        hasName = true;
        continue;
      }
      if (/^email\s*=/i.test(trimmed)) {
        resultLines.push(`\temail = ${newEmail}`);
        hasEmail = true;
        continue;
      }
    }

    resultLines.push(line);
  }

  if (inUserSection) {
    if (!hasName) resultLines.push(`\tname = ${newName}`);
    if (!hasEmail) resultLines.push(`\temail = ${newEmail}`);
  }

  if (!foundUserSection) {
    const lastLine = resultLines[resultLines.length - 1];
    if (resultLines.length > 0 && lastLine !== undefined && lastLine.trim() !== "") {
      resultLines.push("");
    }
    resultLines.push("[user]");
    resultLines.push(`\tname = ${newName}`);
    resultLines.push(`\temail = ${newEmail}`);
  }

  return resultLines.join("\n");
}

export function verifyGitConfigUser(configText: string, expectedName: string, expectedEmail: string): boolean {
  const lines = configText.split(/\r?\n/);
  let inUserSection = false;
  let nameFound = false;
  let emailFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const sectionName = trimmed.slice(1, -1).trim();
      inUserSection = sectionName.toLowerCase() === "user";
      continue;
    }
    if (inUserSection) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim().toLowerCase();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === "name" && val === expectedName) nameFound = true;
        if (key === "email" && val === expectedEmail) emailFound = true;
      }
    }
  }

  return nameFound && emailFound;
}

export function SettingsPanel({
  cwd,
  environmentData,
  excludedBranches = [],
  onAddExcludedBranch,
  onRemoveExcludedBranch,
  onOpenAddRemote,
  onRunInTerminal,
}: {
  cwd: string;
  environmentData: GitEnvironmentResult | null;
  excludedBranches?: string[];
  onAddExcludedBranch?: (name: string) => void;
  onRemoveExcludedBranch?: (name: string) => void;
  onOpenAddRemote: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gitignore, setGitignore] = useState("");
  const [gitignoreChanged, setGitignoreChanged] = useState(false);
  const [newExclude, setNewExclude] = useState("");
  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([]);
  const api = readNativeApi();


  useEffect(() => {
    const nativeApi = api;
    if (!nativeApi || !cwd) {
      return;
    }
    let cancelled = false;

    async function loadSettings() {
      if (!nativeApi) return;
      // 1. Load .gitignore
      try {
        const res = await nativeApi.projects.readFile({ cwd, relativePath: ".gitignore" });
        if (res?.contents && !cancelled) {
          setGitignore(res.contents);
          setGitignoreChanged(false);
        }
      } catch {
        // Ignore if no .gitignore file
      }

      // 2. Load .git/config for identity & remotes
      try {
        const configRes = await nativeApi.projects.readFile({ cwd, relativePath: ".git/config" });
        if (configRes?.contents && !cancelled) {
          const text = configRes.contents;

          const nameMatch = text.match(/name\s*=\s*(.+)/i);
          const emailMatch = text.match(/email\s*=\s*(.+)/i);
          if (nameMatch && nameMatch[1]) setName(nameMatch[1].trim());
          if (emailMatch && emailMatch[1]) setEmail(emailMatch[1].trim());

          const parsedRemotes: Array<{ name: string; url: string }> = [];
          const lines = text.split("\n");
          let currentRemote: string | null = null;
          for (const line of lines) {
            const remoteMatch = line.match(/\[remote\s+"([^"]+)"\]/);
            if (remoteMatch && remoteMatch[1]) {
              currentRemote = remoteMatch[1];
            } else if (currentRemote) {
              const urlMatch = line.match(/\s*url\s*=\s*(.+)/);
              if (urlMatch && urlMatch[1]) {
                parsedRemotes.push({ name: currentRemote, url: urlMatch[1].trim() });
                currentRemote = null;
              }
            }
          }
          if (parsedRemotes.length > 0) {
            setRemotes(parsedRemotes);
          }
        }
      } catch {
        // Ignore
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [api, cwd]);

  const handleSaveIdentity = async () => {
    if (!api || !cwd) return;
    let currentConfig = "";
    try {
      try {
        const res = await api.projects.readFile({ cwd, relativePath: ".git/config" });
        currentConfig = res?.contents || "";
      } catch {
        // Ignore if no .git/config exists yet
      }

      const updatedConfig = updateGitConfigUser(currentConfig, name.trim(), email.trim());
      await api.projects.writeFile({ cwd, relativePath: ".git/config", contents: updatedConfig });

      // Verification check: read back and verify contents
      const verifyRes = await api.projects.readFile({ cwd, relativePath: ".git/config" });
      const readBackText = verifyRes?.contents || "";

      if (!verifyGitConfigUser(readBackText, name.trim(), email.trim())) {
        // Rollback on verification failure
        if (currentConfig) {
          await api.projects.writeFile({ cwd, relativePath: ".git/config", contents: currentConfig });
        }
        throw new Error("Git identity write failed verification check; changes rolled back.");
      }

      toastManager.add({ type: "success", title: "Saved Git identity" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not save Git identity",
        description: error instanceof Error ? error.message : "Write error",
      });
    }
  };

  const handleSaveGitignore = async () => {
    if (!api) return;
    try {
      await api.projects.writeFile({ cwd, relativePath: ".gitignore", contents: gitignore });
      setGitignoreChanged(false);
      toastManager.add({ type: "success", title: "Saved .gitignore" });
    } catch (error) {
      toastManager.add({ type: "error", title: "Could not save .gitignore", description: error instanceof Error ? error.message : "Write error" });
    }
  };

  return (
    <div>
      <SectionLabel>Git identity</SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">Used as the author on every commit you make in this project.</p>
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
        </Field>
        <Field label="Email">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Button size="sm" disabled={!name.trim() || !email.trim()} onClick={handleSaveIdentity}>
          Save identity
        </Button>
      </Card>

      <SectionLabel>Excluded watched branches</SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          By default, all local and remote-tracking branches with unmerged commits are watched on Overview. Add branch names here to exclude them from divergence checks.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <TextInput
            value={newExclude}
            onChange={(e) => setNewExclude(e.target.value)}
            placeholder="e.g. feature/old-experiment"
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={!newExclude.trim()}
            onClick={() => {
              if (newExclude.trim()) {
                onAddExcludedBranch?.(newExclude.trim());
                setNewExclude("");
              }
            }}
          >
            Exclude branch
          </Button>
        </div>
        {excludedBranches.length === 0 ? (
          <div className="fs-11 tx-30 px-2 py-2">No branches excluded (watching all branches).</div>
        ) : (
          excludedBranches.map((b) => (
            <div key={b} className="flex items-center justify-between gap-3 px-2 py-2 border-b bd-1 last:border-0">
              <span className="fs-12 font-mono tx-80 truncate">{b}</span>
              <Button variant="ghost" size="sm" onClick={() => onRemoveExcludedBranch?.(b)}>
                Remove
              </Button>
            </div>
          ))
        )}
      </Card>

      <SectionLabel action={<Button variant="ghost" size="sm" onClick={onOpenAddRemote}>Add remote</Button>}>
        Remotes
      </SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          The URLs this project pushes to and pulls from. Most projects only need "origin".
        </p>
        {remotes.length === 0 ? (
          <div className="fs-11 tx-30 px-2 py-2">No remotes configured.</div>
        ) : (
          remotes.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="fs-12 font-mono tx-80">{r.name}</div>
                <div className="fs-10 font-mono tx-30 truncate">{r.url}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRunInTerminal(`git remote remove ${r.name}`)}>
                Remove
              </Button>
            </div>
          ))
        )}
      </Card>

      <SectionLabel>.gitignore</SectionLabel>
      <Card className="p-3">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          Files and folders Git should never track for this project. One pattern per line.
        </p>
        <AutoTextarea
          value={gitignore}
          onChange={(e) => {
            setGitignore(e.target.value);
            setGitignoreChanged(true);
          }}
          minRows={4}
          className="w-full border bd-2 rounded-lg tx font-mono fs-11 ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
        <div className="mt-2.5">
          <Button size="sm" disabled={!gitignoreChanged} onClick={() => void handleSaveGitignore()}>
            Save .gitignore
          </Button>
        </div>
      </Card>
    </div>
  );
}
