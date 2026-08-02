import {
  AlertTriangle,
  CircleAlert,
  Loader2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

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
      {dir && <div className="text-[10px] font-mono text-muted-foreground/70 truncate leading-tight">{dir}/</div>}
      <div className={`${size} font-mono text-foreground/90 truncate leading-tight`}>{file}</div>
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
    <div className={`flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-2.5 py-2 ${className || "mb-2"}`}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none min-w-0"
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

