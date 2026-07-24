// ─────────────────────────────────────────────────────────────────────────
// COMPOSER / PROMPT BOX — extracted in isolation
//
// This file contains ONLY the bottom prompt box and the small pieces it
// directly renders: the model picker, mode toggle, access mode button,
// context window meter, and the input + send button.
//
// Nothing else from the app is included on purpose. Scope is limited to:
//   - PROVIDERS, ACCESS_MODES (data)
//   - FusedModelPicker, ModeToggle, AccessModeButton, ContextWindowMeter
//   - Composer (the actual prompt box — this is the component to mount)
//
// External dependencies this file assumes exist elsewhere in the app and
// should NOT be recreated or renamed:
//   - Tailwind CSS (utility classes used throughout)
//   - lucide-react (icons)
//   - CSS custom properties from the surrounding theme, referenced via
//     var(--fg), var(--fg-XX), var(--overlay-XX), var(--border-XX),
//     var(--invert-text). These must already be defined on an ancestor
//     element (e.g. a `.theme-dark` / `.theme-light` class on <body> or a
//     wrapper). If they aren't defined, colors will silently fall back to
//     "unset" rather than error — check that the theme class is present.
//   - Two small CSS classes referenced by className: `.custom-scrollbar`
//     and `.composer-focus-ring`. Their definitions are included at the
//     bottom of this file as a reference — port them into your global
//     stylesheet, don't invent new ones.
//
// Props for <Composer>:
//   onSend(text: string)   — called when the user submits a message
//   isRunning: boolean     — true while a response is generating (swaps
//                             the send button for a stop button)
//   onStop()                — called when the stop button is clicked
// ─────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon, ArrowUp, ChevronDown,
  Lock, Pencil, LockOpen, ListTodo, Bot, Square, Check,
} from 'lucide-react';

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude', color: '#f0a35a', models: [
    { id: 'claude-sonnet', label: 'Claude 3.7 Sonnet', efforts: ['Low', 'Medium', 'High'] },
    { id: 'claude-opus', label: 'Claude 3.5 Opus', efforts: ['Low', 'Medium', 'High'] },
  ]},
  { id: 'openai', label: 'OpenAI', color: '#34d399', models: [
    { id: 'gpt-5', label: 'GPT-5', efforts: ['Low', 'Medium', 'High', 'Max'] },
  ]},
  { id: 'xai', label: 'Grok', color: '#38bdf8', models: [
    { id: 'grok-4', label: 'Grok 4', efforts: ['Fast', 'Think'] },
  ]},
  { id: 'opencode', label: 'Opencode', color: '#8b5cf6', models: [
    { id: 'opencode', label: 'Opencode', efforts: ['Standard', 'Ultra'] },
  ]},
];

const FusedModelPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState(value.providerId);
  const [ultra, setUltra] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeProvider = PROVIDERS.find(p => p.id === activeProviderId) || PROVIDERS[0];
  const selectedProvider = PROVIDERS.find(p => p.models.some(m => m.id === value.modelId)) || activeProvider;
  const selectedModel = selectedProvider.models.find(m => m.id === value.modelId) || selectedProvider.models[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-sm text-xs text-white/70 hover:text-white font-medium transition-all max-w-56"
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--fg-50)' }}></span>
        <span className="truncate">{selectedModel.label} · {value.effort}</span>
        <ChevronDown size={10} className={`ml-1 opacity-50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 flex gap-3 rounded-2xl border border-white/10 bg-neutral-900/95 p-3 backdrop-blur-xl z-50 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Provider column */}
          <div className="flex flex-col gap-1">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveProviderId(p.id)}
                className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
                  p.id === activeProviderId ? 'bg-white/10 border-white/20' : 'bg-white/5 hover:bg-white/10 border-transparent'
                }`}
                title={p.label}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--fg-50)' }}></span>
              </button>
            ))}
          </div>

          {/* Model list + effort pills */}
          <div className="flex flex-col gap-1 w-64">
            {activeProvider.models.map(m => {
              const isActive = m.id === value.modelId;
              return (
                <div key={m.id} className={`rounded-lg transition-all ${isActive ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                  <button
                    onClick={() => onChange({ providerId: activeProvider.id, modelId: m.id, effort: m.efforts[0] })}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-xs font-mono" style={{ color: isActive ? 'var(--fg-90)' : 'var(--fg-70)' }}>
                      {m.label}
                    </span>
                    {isActive && <Check size={11} style={{ color: 'var(--fg-90)' }} />}
                  </button>
                  {isActive && (
                    <div className="flex items-center gap-1 px-3 pb-2 flex-wrap">
                      {m.efforts.map(effort => (
                        <button
                          key={effort}
                          onClick={() => onChange({ providerId: activeProvider.id, modelId: m.id, effort })}
                          className="px-2 py-0.5 rounded text-xs font-mono transition-colors"
                          style={
                            value.effort === effort
                              ? { backgroundColor: 'var(--overlay-10)', color: 'var(--fg-90)' }
                              : { color: 'var(--fg-30)' }
                          }
                        >
                          {effort}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Ultra lever */}
          <button
            onClick={() => setUltra(u => !u)}
            className="relative w-8 rounded-full transition-colors shrink-0"
            style={{ backgroundColor: ultra ? 'var(--overlay-20)' : 'var(--overlay-5)' }}
            title="Ultra mode"
          >
            <span className="block h-32"></span>
            <div
              className="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full transition-all duration-200"
              style={{
                top: ultra ? '4px' : 'calc(100% - 28px)',
                backgroundColor: ultra ? 'var(--fg)' : 'var(--fg-30)',
              }}
            ></div>
          </button>
        </div>
      )}
    </div>
  );
};

const ACCESS_MODES = [
  { id: 'supervised', label: 'Supervised', icon: Lock, tint: 'text-white/50' },
  { id: 'auto', label: 'Auto-accept edits', icon: Pencil, tint: 'text-white/70' },
  { id: 'full', label: 'Full access', icon: LockOpen, tint: 'text-white/90' },
];

const AccessModeButton = ({ value, onChange }) => {
  const mode = ACCESS_MODES.find(m => m.id === value) || ACCESS_MODES[0];
  const Icon = mode.icon;
  return (
    <button
      onClick={() => {
        const idx = ACCESS_MODES.findIndex(m => m.id === value);
        onChange(ACCESS_MODES[(idx + 1) % ACCESS_MODES.length].id);
      }}
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-sm text-xs font-medium transition-all ${mode.tint || ''}`}
    >
      <Icon size={12} />
      {mode.label}
    </button>
  );
};

const ModeToggle = ({ value, onChange }) => {
  const isPlan = value === 'plan';
  return (
    <button
      onClick={() => onChange(isPlan ? 'build' : 'plan')}
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border shadow-sm text-xs font-medium transition-all ${
        isPlan
          ? 'bg-white/10 border-white/20 text-white'
          : 'bg-white/[0.04] border-white/10 hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white/80'
      }`}
    >
      {isPlan ? <ListTodo size={12} /> : <Bot size={12} />}
      {isPlan ? 'Plan' : 'Build'}
    </button>
  );
};

const ContextWindowMeter = ({ used, total }) => {
  const [hover, setHover] = useState(false);
  const pct = Math.min(100, Math.round((used / total) * 100));
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-sm transition-all">
        <svg width="16" height="16" viewBox="0 0 24 24" className="-rotate-90">
          <circle cx="12" cy="12" r={radius} fill="none" stroke="var(--fg)" strokeOpacity="0.12" strokeWidth="2.5" />
          <circle
            cx="12" cy="12" r={radius} fill="none"
            stroke={pct > 85 ? '#f87171' : 'var(--fg-60)'}
            strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
          />
        </svg>
      </button>

      {hover && (
        <div className="absolute bottom-full mb-2 right-0 w-52 bg-neutral-900 border border-white/10 rounded-lg shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="text-xs font-semibold text-white mb-1">Context window</div>
          <div className="text-xs text-white/50 font-mono">{used.toLocaleString()} / {total.toLocaleString()} tokens used</div>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct > 85 ? '#f87171' : 'var(--fg-60)' }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// The prompt box itself. Mount this with onSend / isRunning / onStop wired
// to your real send/stop logic.
// ─────────────────────────────────────────────────────────────────────────
export const Composer = ({ onSend, isRunning, onStop }) => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState({ providerId: 'opencode', modelId: 'opencode', effort: 'Standard' });
  const [accessMode, setAccessMode] = useState('full');
  const [composerMode, setComposerMode] = useState('build');
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="composer-focus-ring bg-neutral-900 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all">

      {/* Top action bar of composer */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 bg-neutral-900">
        <div className="flex items-center gap-1.5">
           <FusedModelPicker value={model} onChange={setModel} />
           <div className="w-px h-4 bg-white/10 mx-0.5"></div>
           <ModeToggle value={composerMode} onChange={setComposerMode} />
           <AccessModeButton value={accessMode} onChange={setAccessMode} />
        </div>
        <div className="flex items-center gap-1.5">
           <ContextWindowMeter used={57592} total={128000} />
           <button className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-sm text-white/40 hover:text-white transition-all">
             <ImageIcon size={13} />
           </button>
        </div>
      </div>

      {/* Input area */}
      <div className="relative flex items-end p-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything, @tag files/folders, or use / for commands..."
          className="custom-scrollbar w-full bg-transparent text-sm text-white placeholder-white/30 p-3 outline-none resize-none min-h-14 max-h-96 overflow-y-auto leading-relaxed"
          rows={1}
        />
        {isRunning ? (
          <button
            onClick={onStop}
            className="p-2.5 rounded-lg mb-1 mr-1 bg-rose-500/90 hover:bg-rose-500 hover:scale-105 transition-all"
            title="Stop generation"
          >
            <Square size={14} className="fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`p-2.5 rounded-lg mb-1 mr-1 transition-all hover:opacity-85 ${
              input.trim() ? '' : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
            style={input.trim() ? { backgroundColor: 'var(--fg)', color: 'var(--invert-text)' } : undefined}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Composer;

// ─────────────────────────────────────────────────────────────────────────
// Reference CSS (not injected automatically — copy into your global
// stylesheet if these two classes aren't already defined there):
//
// .custom-scrollbar {
//   scrollbar-width: thin;
//   scrollbar-color: var(--scrollbar-thumb) transparent;
// }
// .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
// .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
// .custom-scrollbar::-webkit-scrollbar-thumb {
//   background: var(--scrollbar-thumb);
//   border-radius: 9999px;
// }
// .custom-scrollbar::-webkit-scrollbar-thumb:hover {
//   background: var(--scrollbar-thumb-hover);
// }
// .composer-focus-ring:focus-within {
//   border-color: var(--border-40);
//   box-shadow: 0 0 0 1px var(--border-30);
// }
// ─────────────────────────────────────────────────────────────────────────