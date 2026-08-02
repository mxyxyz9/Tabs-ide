import {
  AlertTriangle,
  CircleAlert,
  Loader2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

const ACCENT = "var(--gt-accent, var(--primary, #ffffff))";
const ACCENT_CONTRAST = "var(--gt-accent-contrast, var(--primary-foreground, #000000))";

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
          {body && <span className="text-xs tx-70 leading-relaxed">{body}</span>}
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
      <span className="text-xs font-mono uppercase tracking-widest tx-30">{children}</span>
      {action}
    </div>
  );
}

export function Card({ children, className = "", style, onClick }: { children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div className={`border bd-2 rounded-lg ${className}`} style={{ backgroundColor: "var(--bg-surface)", ...style }} onClick={onClick}>
      {children}
    </div>
  );
}

export function PathBreadcrumb({ path }: { path: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  const content = (
    <span className="text-xs font-mono truncate flex items-center gap-1 min-w-0">
      {parts.length > 0 && <span className="tx-30 truncate">{parts.join("/")}/</span>}
      <span className="tx-85 font-medium shrink-0">{file}</span>
    </span>
  );
  return (
    <Tooltip>
      <TooltipTrigger render={content} />
      <TooltipPopup side="top" className="max-w-md break-all">{path}</TooltipPopup>
    </Tooltip>
  );
}

export function FilePathLabel({ path, size = "fs-11" }: { path: string; size?: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  const dir = parts.join("/");
  const content = (
    <div className="min-w-0 flex-1">
      {dir && <div className="fs-10 font-mono tx-30 truncate leading-tight">{dir}/</div>}
      <div className={`${size} font-mono tx-80 truncate leading-tight`}>{file}</div>
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
    <span className="flex items-center gap-1.5 fs-11 font-mono shrink-0">
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
          className={`absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"} ${width} rounded-xl shadow-2xl overflow-hidden z-50 border bd-2`}
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

import { Button } from "../ui/button";

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
  onSubmit: (val: string) => void;
  onCancel: () => void;
  submitLabel?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className={`flex items-center gap-2 bg-o1 bd-2 rounded-lg px-2.5 py-2 ${className || "mb-2"}`}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs font-mono tx outline-none min-w-0"
      />
      <Button size="sm" disabled={!value.trim()} onClick={() => value.trim() && onSubmit(value.trim())}>
        {submitLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
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
    <label className="fs-10 uppercase tracking-widest tx-30 block mb-1.5">{label}</label>
    {children}
  </div>
);

export const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full border bd-2 rounded-lg tx text-xs ph-25 px-3 py-2 outline-none foc-bd-3 transition-colors ${props.className || ""}`}
    style={{ backgroundColor: "var(--bg-base)" }}
  />
);

export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full border bd-2 rounded-lg tx text-xs px-3 py-2 outline-none foc-bd-3 transition-colors ${props.className || ""}`}
    style={{ backgroundColor: "var(--bg-base)" }}
  />
);

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const widthClass = width.startsWith("w-") || width.includes(" w-") ? width : `w-full ${width}`;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm"
      style={{ backgroundColor: "color-mix(in srgb, var(--background) 65%, transparent)" }}
      onClick={onClose}
    >
      <div
        className={`${widthClass} max-h-[88vh] flex flex-col rounded-xl border bd-2 shadow-2xl overflow-hidden`}
        style={{ backgroundColor: "var(--bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b bd-1 shrink-0">
          <span className="text-sm font-semibold tx">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
