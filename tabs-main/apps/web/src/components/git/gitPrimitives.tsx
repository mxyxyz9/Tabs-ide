import {
  AlertTriangle,
  Check,
  CircleAlert,
  Copy,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

const ACCENT = "var(--gt-accent, var(--primary, #ffffff))";
const ACCENT_CONTRAST = "var(--gt-accent-contrast, var(--primary-foreground, #ffffff))";

export const TONE = {
  ok: { color: "var(--sem-emerald)", dot: "var(--sem-emerald)", soft: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
  warn: { color: "var(--sem-amber)", dot: "var(--sem-amber)", soft: "var(--sem-amber-soft)", border: "var(--sem-amber-border)" },
  bad: { color: "var(--sem-red)", dot: "var(--sem-red)", soft: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
  info: { color: "var(--sem-sky)", dot: "var(--sem-sky)", soft: "var(--sem-sky-soft)", border: "var(--sem-sky-border)" },
};


export function Banner({
  tone = "info",
  title,
  body,
  actions,
}: {
  tone?: "ok" | "warn" | "bad" | "info";
  title: string;
  body?: string;
  actions?: ReactNode;
}) {
  const c = TONE[tone];
  const Icon = tone === "warn" ? AlertTriangle : CircleAlert;
  return (
    <div
      className="w-full flex items-center justify-between gap-4 rounded-lg border px-4 py-3 mb-4"
      style={{ borderColor: c.border, backgroundColor: c.soft }}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Icon size={14} className="shrink-0 mt-0.5" style={{ color: c.color }} />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold" style={{ color: c.color }}>
            {title}
          </span>
          {body && <span className="text-xs text-foreground/90 leading-relaxed">{body}</span>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-auto">{actions}</div>}
    </div>
  );
}

export function PanelToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-4 ${className}`}>
      <div className="flex items-center gap-2 ms-auto">{children}</div>
    </div>
  );
}


import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-5 mb-2 first:mt-0">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70">{children}</span>
      {action}
    </div>
  );
}

export function Card({ children, className = "", style, onClick }: { children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div className={`border border-border rounded-lg ${className}`} style={{ backgroundColor: "var(--bg-surface)", ...style }} onClick={onClick}>
      {children}
    </div>
  );
}

export function PathBreadcrumb({ path }: { path: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  const content = (
    <span className="text-xs font-mono truncate flex items-center gap-1 min-w-0">
      {parts.length > 0 && <span className="text-muted-foreground/70 truncate">{parts.join("/")}/</span>}
      <span className="text-foreground/90 font-medium shrink-0">{file}</span>
    </span>
  );
  return (
    <Tooltip>
      <TooltipTrigger render={content} />
      <TooltipPopup side="top" className="max-w-md break-all">{path}</TooltipPopup>
    </Tooltip>
  );
}

export function FilePathLabel({ path, size = "text-[11px]" }: { path: string; size?: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  const dir = parts.join("/");
  const content = (
    <div className="min-w-0 flex-1">
      {dir && <div className="text-[10px] font-mono text-muted-foreground/70 truncate leading-normal pb-0.5">{dir}/</div>}
      <div className={`${size} font-mono text-foreground/90 truncate leading-normal pb-0.5`}>{file}</div>
    </div>
  );
  return (
    <Tooltip>
      <TooltipTrigger render={content} />
      <TooltipPopup side="top" className="max-w-md break-all">{path}</TooltipPopup>
    </Tooltip>
  );
}

export function StatPill({ ins, del }: { ins: number; del: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--sem-emerald-soft)", color: "var(--sem-emerald)" }}>
        +{ins}
      </span>
      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--sem-red-soft)", color: "var(--sem-red)" }}>
        -{del}
      </span>
    </span>
  );
}

export function Dropdown({
  trigger,
  children,
  open,
  setOpen,
  align = "left",
  width = "w-72",
}: {
  trigger: (toggle: () => void) => ReactNode;
  children: ReactNode;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  align?: "left" | "right";
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div
          className={`absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"} ${width} rounded-xl shadow-2xl overflow-hidden z-50 border border-border`}
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function InlineForm({
  placeholder,
  initial = "",
  onSubmit,
  onCancel,
  submitLabel = "Save",
  className = "",
}: {
  placeholder: string;
  initial?: string;
  onSubmit: (val: string) => void | Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const loadingLabel = (() => {
    if (submitLabel.toLowerCase() === "create") return "Creating…";
    if (submitLabel.toLowerCase() === "create tag") return "Creating tag…";
    if (submitLabel.toLowerCase() === "rename") return "Renaming…";
    if (submitLabel.toLowerCase() === "save") return "Saving…";
    return submitLabel.replace(/e$/i, "") + "ing…";
  })();

  return (
    <div className={`flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-2.5 py-2 ${className || "mb-2"}`}>
      <input
        autoFocus
        disabled={submitting}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSubmit();
          if (e.key === "Escape" && !submitting) onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none min-w-0 disabled:opacity-50"
      />
      <Button size="sm" disabled={!value.trim() || submitting} onClick={() => void handleSubmit()}>
        {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
        {submitting ? loadingLabel : submitLabel}
      </Button>
      <Button variant="ghost" size="sm" disabled={submitting} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className = "",
  minRows = 2,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
      style={{ backgroundColor: "var(--bg-base)", resize: "none", overflow: "hidden" }}
    />
  );
}

export const Field = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="mb-3">
    <label className="text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1.5">{label}</label>
    {children}
  </div>
);

export const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full border border-border rounded-lg text-foreground text-xs placeholder:text-muted-foreground/50 px-3 py-2 outline-none focus:border-border transition-colors ${props.className || ""}`}
    style={{ backgroundColor: "var(--bg-base)" }}
  />
);

import React from "react";
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export const Select = ({
  value,
  onChange,
  children,
  className,
  disabled,
}: {
  value?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) => {
  const options: Array<{ value: string; label: React.ReactNode }> = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const props = child.props as { value?: string | number; children?: React.ReactNode };
      const val = props.value !== undefined ? String(props.value) : "";
      const label = props.children !== undefined ? props.children : val;
      options.push({ value: val, label });
    }
  });

  const strVal = value !== undefined ? String(value) : options[0]?.value ?? "";
  const selectedLabel = options.find((o) => o.value === strVal)?.label ?? strVal;

  return (
    <SelectRoot
      value={strVal}
      disabled={disabled}
      onValueChange={(val) => {
        if (val !== null && val !== undefined) {
          onChange?.({ target: { value: val } });
        }
      }}
    >
      <SelectTrigger className={`w-full text-xs rounded-lg bg-background border-border/80 focus:ring-1 focus:ring-primary ${className || ""}`}>
        <SelectValue placeholder="Select…">{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="z-[350] min-w-[200px]">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs font-mono py-1.5 cursor-pointer">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
};

export interface DiffSummaryCardProps {
  summary: string;
  keyChanges: string;
  notesAndRisk?: string | undefined;
  targetScope?: "staged" | "working_tree" | "commit" | undefined;
  wasTruncated?: boolean | undefined;
  truncatedReason?: string | undefined;
  onClose?: (() => void) | undefined;
}

export function DiffSummaryCard({
  summary,
  keyChanges,
  notesAndRisk,
  targetScope,
  wasTruncated,
  truncatedReason,
  onClose,
}: DiffSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const fullText = [
    `### Summary\n${summary}`,
    `### Key Changes\n${keyChanges}`,
    notesAndRisk ? `### Notes & Risk\n${notesAndRisk}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const handleCopy = () => {
    navigator.clipboard?.writeText(fullText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const scopeLabel =
    targetScope === "staged"
      ? "Staged changes"
      : targetScope === "commit"
      ? "Commit summary"
      : "Working tree changes";

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-lg space-y-3 mb-4 relative">
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground tracking-tight">
            AI Diff Summary
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {scopeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-[11px] gap-1">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {wasTruncated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{truncatedReason || "Summary based on partial diff — large files/patches were truncated."}</span>
        </div>
      )}

      <div className="space-y-3 text-xs leading-relaxed">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
            Summary
          </h4>
          <p className="text-foreground/90 font-medium">{summary}</p>
        </div>

        {keyChanges && (
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
              Key Changes
            </h4>
            <div className="text-muted-foreground/90 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
              {keyChanges}
            </div>
          </div>
        )}

        {notesAndRisk && (
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
              Notes & Risk
            </h4>
            <div className="text-muted-foreground/90 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
              {notesAndRisk}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

