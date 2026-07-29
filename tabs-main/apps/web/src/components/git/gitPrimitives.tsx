import {
  AlertTriangle,
  CircleAlert,
  Loader2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

const ACCENT = "var(--accent)";
const ACCENT_CONTRAST = "var(--accent-contrast)";

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
          {body && <span className="text-xs tx-50 leading-relaxed">{body}</span>}
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


export function Btn({
  children,
  icon: Icon,
  primary,
  ghost,
  sm,
  disabled,
  title,
  onClick,
  as: As = "button",
  href,
  className: extraClass = "",
}: {
  children?: ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }> | undefined;
  primary?: boolean;
  ghost?: boolean;
  sm?: boolean;
  disabled?: boolean;
  title?: string | undefined;
  onClick?: () => void;
  as?: "button" | "a";
  href?: string;
  className?: string;
}) {
  const cls = `inline-flex items-center gap-1.5 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
    sm ? "h-6 px-2 fs-11" : "h-7 px-2.5 text-xs"
  } ${
    primary
      ? "hover:opacity-90"
      : ghost
        ? "bg-transparent hov-bg-o1 border bd-1 hov-bd-2 tx-60 hov-tx-90"
        : "bg-o1 hov-bg-o2 bd-1 hov-bd-2 tx-70 hov-tx"
  } ${disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""} ${extraClass}`;
  const style = primary && !disabled ? { backgroundColor: ACCENT, color: ACCENT_CONTRAST } : undefined;
  const content = (
    <>
      {Icon && <Icon size={sm ? 11 : 12} className={Icon === Loader2 ? "animate-spin" : ""} />}
      {children}
    </>
  );
  if (As === "a") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={cls} style={style}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls} style={style}>
      {content}
    </button>
  );
}

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
  return (
    <span className="text-xs font-mono truncate flex items-center gap-1 min-w-0" title={path}>
      {parts.length > 0 && <span className="tx-30 truncate">{parts.join("/")}/</span>}
      <span className="tx-85 font-medium shrink-0">{file}</span>
    </span>
  );
}

export function FilePathLabel({ path, size = "fs-11" }: { path: string; size?: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  const dir = parts.join("/");
  return (
    <div className="min-w-0 flex-1" title={path}>
      {dir && <div className="fs-10 font-mono tx-30 truncate leading-tight">{dir}/</div>}
      <div className={`${size} font-mono tx-80 truncate leading-tight`}>{file}</div>
    </div>
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

export interface BadgeProps {
  children: ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "emerald" | "amber" | "red" | "purple" | "sky" | "muted" | "open" | "draft" | "merged" | "closed";
  mono?: boolean;
  className?: string;
}

export function Badge({ children, icon: Icon, tone = "default", mono = true, className = "" }: BadgeProps) {
  const DEFAULT_TONE = {
    color: "color-mix(in srgb, var(--foreground) 80%, transparent)",
    bg: "color-mix(in srgb, var(--foreground) 6%, transparent)",
    border: "color-mix(in srgb, var(--foreground) 15%, transparent)",
  };
  const TONES: Record<string, { color: string; bg: string; border?: string }> = {
    default: DEFAULT_TONE,
    emerald: { color: "var(--sem-emerald)", bg: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
    open: { color: "var(--sem-emerald)", bg: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
    amber: { color: "var(--sem-amber)", bg: "var(--sem-amber-soft)", border: "var(--sem-amber-border)" },
    red: { color: "var(--sem-red)", bg: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
    closed: { color: "var(--sem-red)", bg: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
    purple: { color: "var(--sem-purple)", bg: "var(--sem-purple-soft)", border: "rgba(192, 132, 252, 0.25)" },
    merged: { color: "var(--sem-purple)", bg: "var(--sem-purple-soft)", border: "rgba(192, 132, 252, 0.25)" },
    sky: { color: "var(--sem-sky)", bg: "var(--sem-sky-soft)", border: "var(--sem-sky-border)" },
    muted: {
      color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
      bg: "color-mix(in srgb, var(--foreground) 5%, transparent)",
      border: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    },
    draft: {
      color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
      bg: "color-mix(in srgb, var(--foreground) 5%, transparent)",
      border: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    },
  };

  const currentTone = TONES[tone] ?? DEFAULT_TONE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 fs-10 ${
        mono ? "font-mono" : "font-medium"
      } shrink-0 ${className}`}
      style={{
        color: currentTone.color,
        backgroundColor: currentTone.bg,
        borderColor: currentTone.border || "color-mix(in srgb, var(--foreground) 12%, transparent)",
      }}
    >
      {Icon && <Icon size={11} className="shrink-0" />}
      {children}
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
    <div className={`flex items-center gap-2 bg-o1 border bd-2 rounded-lg px-2.5 py-2 ${className || "mb-2"}`}>
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
      <Btn sm primary disabled={!value.trim()} onClick={() => value.trim() && onSubmit(value.trim())}>
        {submitLabel}
      </Btn>
      <Btn sm ghost onClick={onCancel}>
        Cancel
      </Btn>
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm"
      style={{ backgroundColor: "color-mix(in srgb, var(--background) 65%, transparent)" }}
      onClick={onClose}
    >
      <div
        className={`${widthClass} rounded-xl border bd-2 shadow-2xl overflow-hidden`}
        style={{ backgroundColor: "var(--bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b bd-1">
          <span className="text-sm font-semibold tx">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
