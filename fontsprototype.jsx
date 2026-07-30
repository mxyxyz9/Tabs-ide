import React, { useState, useEffect } from 'react';

const FONT_CONFIGS = [
  {
    id: 1, name: "The Linear Vibe", sansClass: "f-inter-tight font-bold tracking-tighter lowercase", serifClass: "f-instrument italic font-normal normal-case", uiMainFont: "f-inter-tight tracking-tight", uiAccentFont: "f-instrument italic",
    desc: "Inter Tight & Instrument Serif", sansText: "pre", serifText: "cision ", sansText2: "scale"
  },
  {
    id: 2, name: "Brutalist Agency", sansClass: "f-syne font-extrabold tracking-tighter lowercase", serifClass: "f-newsreader italic font-normal normal-case", uiMainFont: "f-syne", uiAccentFont: "f-newsreader italic",
    desc: "Syne (ExtraBold) & Newsreader (Italic)", sansText: "ab", serifText: "stract ", sansText2: "forms"
  },
  {
    id: 3, name: "Modern Web3", sansClass: "f-space-grotesk font-bold tracking-tight lowercase", serifClass: "f-dotgothic font-normal normal-case", uiMainFont: "f-space-grotesk", uiAccentFont: "f-dotgothic",
    desc: "Space Grotesk & DotGothic16", sansText: "geo", serifText: "metric ", sansText2: "node"
  },
  {
    id: 4, name: "Trendy Grotesque", sansClass: "f-bricolage font-black tracking-tighter lowercase", serifClass: "f-fraunces italic font-light normal-case", uiMainFont: "f-bricolage", uiAccentFont: "f-fraunces italic",
    desc: "Bricolage Grotesque & Fraunces", sansText: "syn", serifText: "thetic ", sansText2: "mind"
  },
  {
    id: 5, name: "The FinTech", sansClass: "f-plus-jakarta font-extrabold tracking-tighter lowercase", serifClass: "f-playfair italic font-medium normal-case", uiMainFont: "f-plus-jakarta", uiAccentFont: "f-playfair italic",
    desc: "Plus Jakarta Sans & Playfair Display", sansText: "liq", serifText: "uidity ", sansText2: "pool"
  },
  {
    id: 6, name: "Developer Core", sansClass: "f-outfit font-black tracking-tighter lowercase", serifClass: "f-jetbrains italic font-normal normal-case", uiMainFont: "f-outfit", uiAccentFont: "f-jetbrains italic",
    desc: "Outfit & JetBrains Mono", sansText: "a", serifText: "sync ", sansText2: "ops"
  },
  {
    id: 7, name: "Avant-Garde", sansClass: "f-chivo font-black tracking-tighter lowercase", serifClass: "f-cormorant italic font-medium normal-case", uiMainFont: "f-chivo", uiAccentFont: "f-cormorant italic",
    desc: "Chivo (Ink Traps) & Cormorant Garamond", sansText: "ki", serifText: "netic ", sansText2: "type"
  },
  {
    id: 8, name: "Hardware/Industrial", sansClass: "f-epilogue font-black tracking-tighter lowercase", serifClass: "f-plex-mono italic font-normal normal-case", uiMainFont: "f-epilogue", uiAccentFont: "f-plex-mono italic",
    desc: "Epilogue & IBM Plex Mono", sansText: "om", serifText: "ni ", sansText2: "base"
  },
  {
    id: 9, name: "Editorial SaaS", sansClass: "f-manrope font-extrabold tracking-tighter lowercase", serifClass: "f-instrument italic font-normal normal-case", uiMainFont: "f-manrope", uiAccentFont: "f-instrument italic",
    desc: "Manrope & Instrument Serif", sansText: "neu", serifText: "ral ", sansText2: "net"
  },
  {
    id: 10, name: "Neo-Tech Start", sansClass: "f-unbounded font-black tracking-tighter lowercase", serifClass: "f-newsreader italic font-normal normal-case", uiMainFont: "f-unbounded", uiAccentFont: "f-newsreader italic",
    desc: "Unbounded & Newsreader", sansText: "lu", serifText: "cid ", sansText2: "state"
  }
];

const THEME_CONFIGS = [
  {
    id: 'system', name: 'System Auto', desc: 'Match OS color scheme', tag: 'AUTO',
    vars: { '--bg-main': '#09090B', '--bg-sidebar': '#050505', '--bg-panel': '#18181B', '--bg-hover': '#0f0f11', '--border-color': '#27272A', '--text-main': '#FAFAFA', '--text-muted': '#A1A1AA', '--accent-color': '#6366F1' },
    preview: { bg: 'linear-gradient(135deg, #09090B 50%, #FAFAFA 50%)', head: '#18181B', acc: '#6366F1' }
  },
  {
    id: 'tabs-dark', name: 'Tabs Dark', desc: 'Default high-contrast dark...', tag: 'DARK',
    vars: { '--bg-main': '#09090B', '--bg-sidebar': '#050505', '--bg-panel': '#18181B', '--bg-hover': '#0f0f11', '--border-color': '#27272A', '--text-main': '#FAFAFA', '--text-muted': '#A1A1AA', '--accent-color': '#6366F1' },
    preview: { bg: '#09090B', head: '#18181B', acc: '#6366F1' }
  },
  {
    id: 'true-black', name: 'True Black', desc: 'Monotone OLED pure black...', tag: 'OLED',
    vars: { '--bg-main': '#000000', '--bg-sidebar': '#000000', '--bg-panel': '#080808', '--bg-hover': '#121212', '--border-color': '#222222', '--text-main': '#FFFFFF', '--text-muted': '#777777', '--accent-color': '#FFFFFF' },
    preview: { bg: '#000000', head: '#080808', acc: '#FFFFFF' }
  },
  {
    id: 'tabs-light', name: 'Tabs Light', desc: 'Clean, warm light mode...', tag: 'LIGHT',
    vars: { '--bg-main': '#FAFAFA', '--bg-sidebar': '#F4F4F5', '--bg-panel': '#FFFFFF', '--bg-hover': '#E4E4E7', '--border-color': '#D4D4D8', '--text-main': '#09090B', '--text-muted': '#52525B', '--accent-color': '#3B82F6' },
    preview: { bg: '#FAFAFA', head: '#E4E4E7', acc: '#3B82F6' }
  },
  {
    id: 'abyss', name: 'Abyss', desc: 'Deep oceanic dark palette...', tag: 'DARK',
    vars: { '--bg-main': '#040B16', '--bg-sidebar': '#02060D', '--bg-panel': '#0A1526', '--bg-hover': '#07101D', '--border-color': '#152A4A', '--text-main': '#E2E8F0', '--text-muted': '#94A3B8', '--accent-color': '#38BDF8' },
    preview: { bg: '#040B16', head: '#0A1526', acc: '#38BDF8' }
  },
  {
    id: 'dracula', name: 'Dracula', desc: 'Classic dark theme with...', tag: 'DARK',
    vars: { '--bg-main': '#282A36', '--bg-sidebar': '#21222C', '--bg-panel': '#343746', '--bg-hover': '#2a2c38', '--border-color': '#44475A', '--text-main': '#F8F8F2', '--text-muted': '#6272A4', '--accent-color': '#BD93F9' },
    preview: { bg: '#282A36', head: '#343746', acc: '#BD93F9' }
  },
  {
    id: 'deep-blue', name: 'Deep Blue', desc: 'Midnight slate dark theme...', tag: 'DARK',
    vars: { '--bg-main': '#0F172A', '--bg-sidebar': '#0B1120', '--bg-panel': '#1E293B', '--bg-hover': '#162032', '--border-color': '#334155', '--text-main': '#F8FAFC', '--text-muted': '#94A3B8', '--accent-color': '#3B82F6' },
    preview: { bg: '#0F172A', head: '#1E293B', acc: '#3B82F6' }
  },
  {
    id: 'solarized', name: 'Solarized Light', desc: 'Warm cream light theme...', tag: 'LIGHT',
    vars: { '--bg-main': '#FDF6E3', '--bg-sidebar': '#EEE8D5', '--bg-panel': '#FDF6E3', '--bg-hover': '#E5DFCC', '--border-color': '#D3CBB8', '--text-main': '#586E75', '--text-muted': '#93A1A1', '--accent-color': '#268BD2' },
    preview: { bg: '#FDF6E3', head: '#EEE8D5', acc: '#268BD2' }
  },
  {
    id: 'cosmic', name: 'Cosmic Glow', desc: 'User Saved Preset', tag: 'SAVED',
    vars: { '--bg-main': '#0B0914', '--bg-sidebar': '#06050A', '--bg-panel': '#141124', '--bg-hover': '#0e0c19', '--border-color': '#2A244A', '--text-main': '#F8F7FF', '--text-muted': '#9D97B8', '--accent-color': '#A855F7' },
    preview: { bg: '#0B0914', head: '#141124', acc: '#A855F7' }
  },
  {
    id: 'matcha', name: 'Matcha Dust', desc: 'User Saved Preset', tag: 'SAVED',
    vars: { '--bg-main': '#171A18', '--bg-sidebar': '#111312', '--bg-panel': '#222724', '--bg-hover': '#1c201e', '--border-color': '#353D38', '--text-main': '#E8F0EA', '--text-muted': '#8A9990', '--accent-color': '#10B981' },
    preview: { bg: '#171A18', head: '#222724', acc: '#10B981' }
  },
  {
    id: 'kyoto', name: 'Kyoto Echo', desc: 'User Saved Preset', tag: 'SAVED',
    vars: { '--bg-main': '#1C1917', '--bg-sidebar': '#141210', '--bg-panel': '#292524', '--bg-hover': '#211e1d', '--border-color': '#44403C', '--text-main': '#FAFAF9', '--text-muted': '#A8A29E', '--accent-color': '#F97316' },
    preview: { bg: '#1C1917', head: '#292524', acc: '#F97316' }
  },
  {
    id: 'studio', name: 'Custom Theme Studio', desc: 'Build & randomize custo...', tag: 'STUDIO',
    vars: { '--bg-main': '#09090B', '--bg-sidebar': '#050505', '--bg-panel': '#18181B', '--bg-hover': '#0f0f11', '--border-color': '#27272A', '--text-main': '#FAFAFA', '--text-muted': '#A1A1AA', '--accent-color': '#6366F1' },
    isStudio: true
  }
];

const StyleInjector = () => (
  <style>
    {`
      @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600;700;800&family=Space+Grotesk:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Outfit:wght@400;600;800;900&family=Manrope:wght@400;600;800&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,800;12..96,900&family=Chivo:wght@400;900&family=Epilogue:wght@400;700;900&family=Unbounded:wght@400;700;900&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,wght@1,400;1,500&family=DotGothic16&family=Fraunces:ital,opsz,wght@1,9..144,300;1,9..144,400&family=Playfair+Display:ital,wght@1,400;1,600&family=JetBrains+Mono:ital@0;1&family=Cormorant+Garamond:ital,wght@1,400;1,600&family=IBM+Plex+Mono:ital@0;1&display=swap');

      .f-inter-tight { font-family: 'Inter Tight', sans-serif; }
      .f-space-grotesk { font-family: 'Space Grotesk', sans-serif; }
      .f-plus-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
      .f-outfit { font-family: 'Outfit', sans-serif; }
      .f-manrope { font-family: 'Manrope', sans-serif; }
      .f-syne { font-family: 'Syne', sans-serif; }
      .f-bricolage { font-family: 'Bricolage Grotesque', sans-serif; }
      .f-chivo { font-family: 'Chivo', sans-serif; }
      .f-epilogue { font-family: 'Epilogue', sans-serif; }
      .f-unbounded { font-family: 'Unbounded', sans-serif; }
      
      .f-instrument { font-family: 'Instrument Serif', serif; }
      .f-newsreader { font-family: 'Newsreader', serif; }
      .f-dotgothic { font-family: 'DotGothic16', sans-serif; }
      .f-fraunces { font-family: 'Fraunces', serif; }
      .f-playfair { font-family: 'Playfair Display', serif; }
      .f-jetbrains { font-family: 'JetBrains Mono', monospace; }
      .f-cormorant { font-family: 'Cormorant Garamond', serif; }
      .f-plex-mono { font-family: 'IBM Plex Mono', monospace; }

      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background-color: var(--border-color); border-radius: 20px; }
      
      body {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      
      .custom-range { -webkit-appearance: none; background: transparent; }
      .custom-range::-webkit-slider-runnable-track { width: 100%; height: 6px; background: var(--border-color); border-radius: 9999px; }
      .custom-range::-webkit-slider-thumb {
        -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%;
        background: var(--accent-color); cursor: pointer; margin-top: -5px;
        box-shadow: 0 0 12px var(--accent-color); transition: transform 0.1s;
      }
      .custom-range::-webkit-slider-thumb:hover { transform: scale(1.2); }

      /* Premium Theme Transition Animations */
      @keyframes fluidThemePulse {
        0% { transform: scale(1); filter: brightness(1) blur(0px); opacity: 1; }
        30% { transform: scale(0.992); filter: brightness(1.1) blur(1.5px); opacity: 0.95; }
        100% { transform: scale(1); filter: brightness(1) blur(0px); opacity: 1; }
      }
      @keyframes sweepFlash {
        0% { opacity: 0; transform: translateX(-100%); }
        50% { opacity: 0.04; transform: translateX(0%); }
        100% { opacity: 0; transform: translateX(100%); }
      }
      .theme-transitioning {
        animation: fluidThemePulse 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        pointer-events: none;
      }
      .theme-transitioning::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(135deg, transparent, var(--accent-color), transparent);
        opacity: 0; z-index: 50;
        animation: sweepFlash 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }
    `}
  </style>
);

const SettingsReplica = ({ activeFont }) => {
  const { uiMainFont, uiAccentFont, sansClass, serifClass } = activeFont;
  const [activeTab, setActiveTab] = useState('themes');
  const [activeThemeId, setActiveThemeId] = useState('tabs-dark');
  const [animatingTheme, setAnimatingTheme] = useState(false);
  
  const currentTheme = THEME_CONFIGS.find(t => t.id === activeThemeId) || THEME_CONFIGS[1];

  const handleThemeChange = (id) => {
    if (activeThemeId === id) return;
    setAnimatingTheme(true);
    setActiveThemeId(id);
    setTimeout(() => {
      setAnimatingTheme(false);
    }, 500); // Matches the CSS keyframe duration
  };

  const [settings, setSettings] = useState({
    zoom: 100, desktopIcon: 'Dark', timeFormat: 'System', assistantOutput: false,
    alwaysCreateTasks: true, textGenModel: 'Hy3 Free', diffLineWrapping: false,
    colorizePermissions: true, newThreads: 'Local', deleteConfirmation: true, confirmTabClose: true
  });
  
  const [animSettings, setAnimSettings] = useState({
    phase: 'Startup', theme: 'Auto', style: 'Molten Glass', palette: 'Monochrome',
    sliderAnimations: true, animatedSliderFill: true, reloading: false
  });

  const [providersState, setProvidersState] = useState({
    codex: true, claude: true, cursor: true, grok: true, opencode: true
  });

  const [scState, setScState] = useState({
    git: true, jujutsu: false, github: true, gitlab: false, azure: false, bitbucket: false
  });

  const [connState, setConnState] = useState({
    networkAccess: false
  });

  const [workspaceState, setWorkspaceState] = useState({
    tools: [
      { id: 'code', title: 'Code', sub: 'code', active: true },
      { id: 'agents', title: 'Agents', sub: 'agents', active: true },
      { id: 'server', title: 'Server', sub: 'server', active: true },
      { id: 'opencode', title: 'opencode', sub: 'terminal tab', active: true },
      { id: 'claude', title: 'claude', sub: 'terminal tab', active: true },
      { id: 'git', title: 'Git', sub: 'git', active: true },
      { id: 'browser', title: 'Browser', sub: 'browser', active: true },
      { id: 'figma', title: 'figma', sub: 'browser tab', active: true },
    ],
    browserUrl: 'www.google.com',
    resumeStartup: true,
    projectTab: 'Browser Tabs',
    figmaLabel: 'figma',
    figmaUrl: 'www.figma.com',
    figmaShowToolbar: true,
    figmaResume: true
  });

  const [openDropdown, setOpenDropdown] = useState(null);
  const [reloadingOSS, setReloadingOSS] = useState(false);
  const [reloadingBrowser, setReloadingBrowser] = useState(false);

  const triggerAnimReload = () => {
    setAnimSettings(s => ({ ...s, reloading: true }));
    setTimeout(() => setAnimSettings(s => ({ ...s, reloading: false })), 1500);
  };

  const triggerReload = (type) => {
    if (type === 'oss') {
      setReloadingOSS(true); setTimeout(() => setReloadingOSS(false), 1200);
    } else {
      setReloadingBrowser(true); setTimeout(() => setReloadingBrowser(false), 1200);
    }
  };

  const renderToggle = (isActive, onClick) => (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-[48px] h-[26px] rounded-full relative transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none flex items-center shrink-0 border ${
        isActive 
          ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' 
          : 'bg-[var(--bg-main)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
      }`}
      style={{ 
        boxShadow: isActive ? '0 0 24px -2px var(--accent-color), 0 0 12px -2px var(--accent-color)' : 'none' 
      }}
    >
      <div 
        className={`h-[20px] w-[20px] rounded-full absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isActive 
            ? 'bg-[var(--bg-main)] translate-x-[23px] scale-100 shadow-sm' 
            : 'bg-[var(--text-muted)] translate-x-[2px] scale-90'
        }`}
      ></div>
    </button>
  );

  const renderSegmented = (options, currentValue, setter) => (
    <div className="flex bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-1 shadow-inner relative z-0">
      {options.map(opt => (
        <button 
          key={opt} 
          onClick={() => setter(opt)} 
          className={`px-5 py-1.5 text-[12px] font-bold rounded-lg transition-all duration-300 relative z-10 ${currentValue === opt ? 'text-[var(--bg-main)] transform scale-[1.02]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]'}`}
        >
          {currentValue === opt && (
            <div className="absolute inset-0 bg-[var(--accent-color)] rounded-lg -z-10 shadow-[0_0_12px_var(--accent-color)] opacity-90"></div>
          )}
          {opt}
        </button>
      ))}
    </div>
  );

  const navItems = [
    { id: 'general', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
    { id: 'themes', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /> },
    { id: 'animations', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { id: 'providers', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> },
    { id: 'source control', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /> },
    { id: 'connections', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /> },
    { id: 'workspace', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /> },
    { id: 'keybindings', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /> },
    { id: 'about', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> }
  ];

  return (
    <div 
      style={currentTheme.vars} 
      className={`w-full h-full relative bg-[var(--bg-main)] flex ${uiMainFont} text-[var(--text-main)] transition-colors duration-500 overflow-hidden ${animatingTheme ? 'theme-transitioning' : ''}`}
    >
      
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] p-4 md:p-6 flex flex-col gap-1.5 custom-scrollbar overflow-y-auto shrink-0 transition-colors duration-500">
        <div className="flex items-center gap-3 mb-6 px-3">
          <button className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <span className={`text-[13px] font-medium text-[var(--text-muted)] ${sansClass}`}>Settings</span>
        </div>
        
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium w-full text-left transition-colors duration-300 capitalize ${
              activeTab === item.id 
                ? 'bg-[var(--bg-panel)] text-[var(--text-main)] border border-[var(--border-color)] shadow-sm' 
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)] border border-transparent'
            }`}
          >
            <svg className={`w-[18px] h-[18px] ${activeTab === item.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {item.icon}
            </svg>
            <span className={activeTab === item.id ? sansClass : ''}>{item.id}</span>
          </button>
        ))}
      </div>

      {/* Main Settings Panel */}
      <div className="flex-1 bg-[var(--bg-main)] p-8 md:p-12 lg:p-16 custom-scrollbar overflow-y-auto transition-colors duration-500 relative">
        
        {/* Dynamic Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 pb-6 border-b border-[var(--border-color)] gap-6 transition-colors duration-500">
          <div>
            <h1 className={`text-[28px] text-[var(--text-main)] mb-2 capitalize ${sansClass} font-bold`}>{activeTab}</h1>
            <p className={`text-[var(--text-muted)] text-[13px] font-medium`}>
              {activeTab === 'general' && 'Customize appearance, assistant behavior, display settings, and workspace preferences.'}
              {activeTab === 'themes' && 'Choose from curated palettes or build a fully personalized custom color and typography theme.'}
              {activeTab === 'animations' && 'Customize interactive UI transitions and startup animation preferences.'}
              {activeTab === 'providers' && 'Manage AI providers, API keys, custom model endpoints, and status checks.'}
              {activeTab === 'source control' && 'Manage version control systems, code hosting providers, and authentication status.'}
              {activeTab === 'connections' && 'Configure network access, Tailscale HTTPS tunnels, and remote environment connections.'}
              {activeTab !== 'general' && activeTab !== 'themes' && activeTab !== 'animations' && activeTab !== 'providers' && activeTab !== 'source control' && activeTab !== 'connections' && `Configure ${activeTab} preferences and workspace behavior.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'providers' && (
              <button className="px-3.5 py-1.5 border border-[var(--border-color)] bg-[var(--bg-panel)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-[var(--text-main)] rounded-md text-[12px] font-medium transition-all shadow-sm flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh models
              </button>
            )}
            <button className="px-3.5 py-1.5 border border-[var(--border-color)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-md text-[12px] font-medium transition-colors flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Reset to Defaults
            </button>
            {activeTab === 'themes' && (
              <button className="px-3.5 py-1.5 border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-main)] rounded-md text-[12px] font-medium transition-colors flex items-center gap-2 shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Open Custom Studio
              </button>
            )}
          </div>
        </div>

        {activeTab === 'themes' && (
          <div className="animate-in fade-in duration-500 w-full">
            <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>App Themes & Styling</h2>
            
            <div className="border border-[var(--border-color)] rounded-2xl bg-[var(--bg-panel)] p-6 mb-12 shadow-sm transition-colors duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {THEME_CONFIGS.map(theme => (
                  <div 
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`group cursor-pointer rounded-xl border transition-all duration-300 flex flex-col p-3 ${
                      activeThemeId === theme.id 
                        ? 'border-[var(--accent-color)] bg-[var(--bg-hover)] shadow-md shadow-[var(--accent-color)]/10 scale-[1.02]' 
                        : 'border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--text-muted)] hover:scale-[1.01]'
                    }`}
                  >
                    <div 
                      className="h-24 w-full rounded-lg border border-[var(--border-color)] overflow-hidden flex flex-col mb-3 relative"
                      style={theme.isStudio ? { background: '#18181B' } : { background: theme.preview?.bg }}
                    >
                      {theme.isStudio ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors">
                          <svg className="w-6 h-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                          <span className="text-[10px] font-medium">Launch Studio Drawer</span>
                        </div>
                      ) : (
                        <>
                          <div className="h-5 w-full flex items-center px-2 gap-1" style={{ backgroundColor: theme.preview?.head }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                          </div>
                          <div className="flex-1 p-2.5 flex flex-col gap-1.5">
                            <div className="w-1/2 h-1.5 rounded-full" style={{ backgroundColor: theme.preview?.acc }}></div>
                            <div className="w-3/4 h-1.5 rounded-full bg-white/20"></div>
                            <div className="w-2/5 h-1.5 rounded-full bg-white/10 mt-1"></div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between items-end mt-auto">
                      <div>
                        <h3 className={`text-[13px] font-bold text-[var(--text-main)] mb-0.5 ${sansClass}`}>{theme.name}</h3>
                        <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{theme.desc}</p>
                      </div>
                      <span className="text-[9px] font-bold border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)] bg-[var(--bg-panel)]">
                        {theme.tag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Typography & Fonts</h2>
            <div className="border border-[var(--border-color)] rounded-2xl bg-[var(--bg-panel)] p-6 shadow-sm transition-colors duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Interface Font</label>
                  <p className="text-[11px] text-[var(--text-muted)] mb-1">UI labels, buttons, navigation</p>
                  <div className="flex items-center justify-between w-full bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 rounded-lg cursor-pointer">
                    <span className="text-[12px] font-medium text-[var(--text-main)] truncate">system-ui</span>
                    <svg className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Heading Font</label>
                  <p className="text-[11px] text-[var(--text-muted)] mb-1">Headings, section titles, headers</p>
                  <div className="flex items-center justify-between w-full bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 rounded-lg cursor-pointer">
                    <span className="text-[12px] font-medium text-[var(--text-main)] truncate">{uiMainFont.replace('f-', '').replace(/-/g, ' ')}</span>
                    <svg className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-[var(--text-main)]">Editor Font</label>
                  <p className="text-[11px] text-[var(--text-muted)] mb-1">Monospace code, terminals, inputs</p>
                  <div className="flex items-center justify-between w-full bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 rounded-lg cursor-pointer">
                    <span className="text-[12px] font-medium text-[var(--text-main)] truncate">Menlo, Monaco</span>
                    <svg className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="animate-in fade-in duration-500 w-full">
            
            <div className="mb-10 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Appearance & Interface</h2>
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full">
                
                <div className="flex flex-wrap md:flex-nowrap items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="mb-4 md:mb-0">
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Zoom & Scale</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Adjust interface zoom level. Drag slider or use Cmd + / Cmd -.</p>
                  </div>
                  <div className="flex flex-col items-end w-full md:w-64">
                    <div className="flex justify-between w-full text-[10px] text-[var(--text-muted)] font-medium mb-3">
                      <span>Scale Range</span>
                      <span className="text-[var(--text-main)] font-bold">{settings.zoom}%</span>
                    </div>
                    <div className="w-full flex items-center gap-3">
                      <button onClick={() => setSettings(s => ({...s, zoom: Math.max(75, parseInt(s.zoom) - 5)}))} className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-mono">-</button>
                      <input 
                        type="range" min="75" max="150" step="5" value={settings.zoom}
                        onChange={(e) => setSettings(s => ({...s, zoom: e.target.value}))}
                        className="custom-range flex-1"
                      />
                      <button onClick={() => setSettings(s => ({...s, zoom: Math.min(150, parseInt(s.zoom) + 5)}))} className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-mono">+</button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="mb-3 md:mb-0">
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Desktop icon</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Choose which icon variant Tabs uses in the desktop shell.</p>
                  </div>
                  {renderSegmented(['System', 'Dark', 'Light'], settings.desktopIcon, (val) => setSettings(s => ({...s, desktopIcon: val})))}
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl">
                  <div className="mb-3 md:mb-0">
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Time format</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">System default follows your browser or OS clock preference.</p>
                  </div>
                  {renderSegmented(['System', '12h', '24h'], settings.timeFormat, (val) => setSettings(s => ({...s, timeFormat: val})))}
                </div>
              </div>
            </div>

            <div className="mb-10 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Assistant & Code Generation</h2>
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm relative z-20 transition-colors duration-500 w-full">
                
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={() => setSettings(s => ({...s, assistantOutput: !s.assistantOutput}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Assistant output</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Show token-by-token output while a response is in progress.</p>
                  </div>
                  {renderToggle(settings.assistantOutput, () => setSettings(s => ({...s, assistantOutput: !s.assistantOutput})))}
                </div>

                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={() => setSettings(s => ({...s, alwaysCreateTasks: !s.alwaysCreateTasks}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 flex items-center gap-2 ${uiMainFont}`}>
                      Always create tasks <span className="text-[var(--text-muted)] text-[9px] border border-[var(--border-color)] px-1 rounded font-sans uppercase bg-[var(--bg-main)]">↩</span>
                    </h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Synthesize task progress for providers that do not emit native events.</p>
                  </div>
                  {renderToggle(settings.alwaysCreateTasks, () => setSettings(s => ({...s, alwaysCreateTasks: !s.alwaysCreateTasks})))}
                </div>

                <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl">
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 flex items-center gap-2 ${uiMainFont}`}>
                      Text generation model <span className="text-[var(--text-muted)] text-[9px] border border-[var(--border-color)] px-1 rounded font-sans uppercase bg-[var(--bg-main)]">↩</span>
                    </h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Configure the model used for text generation.</p>
                  </div>
                  <div className="relative">
                    <div onClick={() => setOpenDropdown(openDropdown === 'model' ? null : 'model')} className="flex items-center gap-2 bg-[var(--bg-main)] border border-[var(--border-color)] px-4 py-2 rounded-lg cursor-pointer hover:border-[var(--text-muted)] transition-colors w-44 justify-between shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[var(--accent-color)] rounded-sm shadow-[0_0_8px_var(--accent-color)]"></div>
                        <span className={`text-[13px] font-bold text-[var(--text-main)] ${sansClass}`}>{settings.textGenModel}</span>
                      </div>
                      <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-300 ${openDropdown === 'model' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    {openDropdown === 'model' && (
                      <div className="absolute top-full mt-2 right-0 w-44 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                        {['Hy3 Free', 'GPT-4 Turbo', 'Claude 3.5 Sonnet'].map(model => (
                          <button key={model} onClick={() => { setSettings(s => ({...s, textGenModel: model})); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-[13px] font-bold ${sansClass} transition-colors ${settings.textGenModel === model ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'}`}>{model}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-10 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Diff & Display</h2>
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full">
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={() => setSettings(s => ({...s, diffLineWrapping: !s.diffLineWrapping}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Diff line wrapping</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Set the default wrap state when the diff panel opens.</p>
                  </div>
                  {renderToggle(settings.diffLineWrapping, () => setSettings(s => ({...s, diffLineWrapping: !s.diffLineWrapping})))}
                </div>
                <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl cursor-pointer" onClick={() => setSettings(s => ({...s, colorizePermissions: !s.colorizePermissions}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Colorize permissions</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Apply distinct semantic colors to the different permission levels.</p>
                  </div>
                  {renderToggle(settings.colorizePermissions, () => setSettings(s => ({...s, colorizePermissions: !s.colorizePermissions})))}
                </div>
              </div>
            </div>

            <div className="mb-10 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Workspace & Confirmations</h2>
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm relative z-10 transition-colors duration-500 w-full">
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>New threads</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Pick the default workspace mode for newly created draft threads.</p>
                  </div>
                  <div className="relative">
                    <div onClick={() => setOpenDropdown(openDropdown === 'threads' ? null : 'threads')} className="flex items-center justify-between w-36 bg-[var(--bg-main)] border border-[var(--border-color)] px-4 py-2 rounded-lg cursor-pointer hover:border-[var(--text-muted)] transition-colors shadow-sm">
                      <span className={`text-[13px] font-bold text-[var(--text-main)] ${sansClass}`}>{settings.newThreads}</span>
                      <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-300 ${openDropdown === 'threads' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    {openDropdown === 'threads' && (
                      <div className="absolute top-full mt-2 right-0 w-36 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                        {['Local', 'Cloud', 'Memory'].map(opt => (
                          <button key={opt} onClick={() => { setSettings(s => ({...s, newThreads: opt})); setOpenDropdown(null); }} className={`w-full text-left px-4 py-2.5 text-[13px] font-bold ${sansClass} transition-colors ${settings.newThreads === opt ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'}`}>{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={() => setSettings(s => ({...s, deleteConfirmation: !s.deleteConfirmation}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Delete confirmation</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Ask before deleting a thread and its chat history.</p>
                  </div>
                  {renderToggle(settings.deleteConfirmation, () => setSettings(s => ({...s, deleteConfirmation: !s.deleteConfirmation})))}
                </div>
                <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl cursor-pointer" onClick={() => setSettings(s => ({...s, confirmTabClose: !s.confirmTabClose}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Confirm tab close</h3>
                    <p className="text-[12px] text-[var(--text-muted)]">Ask before closing a project tab.</p>
                  </div>
                  {renderToggle(settings.confirmTabClose, () => setSettings(s => ({...s, confirmTabClose: !s.confirmTabClose})))}
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'animations' && (
          <div className="animate-in fade-in duration-500 w-full">
            <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Animation Controls</h2>
            
            <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full mb-10 overflow-hidden">
              <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-panel)]">
                <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] uppercase tracking-wider ${uiMainFont}`}>Startup Animation</h3>
                {renderSegmented(['Startup', 'Close'], animSettings.phase, (val) => setAnimSettings(s => ({...s, phase: val})))}
              </div>
              
              <div className="p-8 bg-[#050505] relative flex flex-col items-center justify-center border-b border-[var(--border-color)] min-h-[400px] overflow-hidden group">
                <div className={`relative z-10 flex flex-col items-center transition-all duration-700 ${animSettings.reloading ? 'scale-90 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'}`}>
                  <h1 className={`text-[64px] font-black text-white tracking-tighter leading-none mb-4 ${sansClass}`}>TABS</h1>
                  <p className={`text-[10px] text-[#A1A1AA] uppercase tracking-[0.3em] font-bold ${sansClass}`}>Negotiating with the linter</p>
                </div>
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--bg-panel)]/80 backdrop-blur-md border border-[var(--border-color)] p-2 rounded-2xl flex items-center gap-6 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-11/12 max-w-2xl justify-between">
                  <div className="flex items-center gap-4 px-2">
                    <span className="text-[11px] text-[var(--text-muted)] font-bold">Preview Theme:</span>
                    {renderSegmented(['Auto', 'Dark', 'Light'], animSettings.theme, (val) => setAnimSettings(s => ({...s, theme: val})))}
                  </div>
                  <button onClick={triggerAnimReload} className="px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-xl text-[12px] font-bold transition-all shadow-sm flex items-center gap-2">
                    <svg className={`w-3.5 h-3.5 ${animSettings.reloading ? 'animate-spin text-[var(--accent-color)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Reload App
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap md:flex-nowrap items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                <div>
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Style</h3>
                  <p className="text-[12px] text-[var(--text-muted)]">Choose the visual aesthetic for the startup animation.</p>
                </div>
                {renderSegmented(['Molten Glass', 'Solari Grid'], animSettings.style, (val) => setAnimSettings(s => ({...s, style: val})))}
              </div>
              
              <div className="flex flex-wrap md:flex-nowrap items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors">
                <div>
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Color palette</h3>
                  <p className="text-[12px] text-[var(--text-muted)]">Choose the color palette for the startup animation.</p>
                </div>
                {renderSegmented(['Solid Block', 'Monochrome'], animSettings.palette, (val) => setAnimSettings(s => ({...s, palette: val})))}
              </div>
            </div>

            <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Interface</h2>
            <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setAnimSettings(s => ({...s, sliderAnimations: !s.sliderAnimations}))}>
                <div>
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Slider animations</h3>
                  <p className="text-[12px] text-[var(--text-muted)] font-medium group-hover:text-[var(--text-main)] transition-colors">Smoothly animate the model picker's reasoning-effort slider.</p>
                </div>
                <div className="pl-4">
                  {renderToggle(animSettings.sliderAnimations, () => setAnimSettings(s => ({...s, sliderAnimations: !s.sliderAnimations})))}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setAnimSettings(s => ({...s, animatedSliderFill: !s.animatedSliderFill}))}>
                <div>
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Animated slider fill</h3>
                  <p className="text-[12px] text-[var(--text-muted)] font-medium group-hover:text-[var(--text-main)] transition-colors">Smoothly animate the fill color of sliders when value changes.</p>
                </div>
                <div className="pl-4">
                  {renderToggle(animSettings.animatedSliderFill, () => setAnimSettings(s => ({...s, animatedSliderFill: !s.animatedSliderFill})))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="animate-in fade-in duration-500 w-full">
            
            <div className="mb-10 w-full">
              <div className="border border-[var(--border-color)] rounded-2xl bg-[var(--bg-panel)] p-1 shadow-sm transition-colors duration-500 w-full">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 border-b border-[var(--border-color)] gap-4 md:gap-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shadow-inner">
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    </div>
                    <div>
                      <h3 className={`text-[14px] font-bold text-[var(--text-main)] flex items-center gap-2 ${sansClass}`}>
                        Pinned Models <span className="flex items-center justify-center w-5 h-5 rounded bg-[var(--bg-main)] border border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">2</span>
                      </h3>
                      <p className="text-[12px] text-[var(--text-muted)]">Quick access models pinned across all providers. Appears at the top of ModelPicker.</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Pin Model
                  </button>
                </div>
                
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-panel)] rounded-b-2xl">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] transition-all group cursor-pointer shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-[var(--bg-panel)] flex items-center justify-center border border-[var(--border-color)]"><span className="text-[12px]">🤖</span></div>
                      <div>
                        <span className={`text-[13px] font-bold text-[var(--text-main)] ${sansClass}`}>GPT-5.6-Terra</span>
                        <span className="text-[12px] text-[var(--text-muted)] ml-2">(Codex)</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-[var(--accent-color)] opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] transition-all group cursor-pointer shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-[var(--bg-panel)] flex items-center justify-center border border-[var(--border-color)]"><span className="text-[12px]">⚡</span></div>
                      <div>
                        <span className={`text-[13px] font-bold text-[var(--text-main)] ${sansClass}`}>Auto</span>
                        <span className="text-[12px] text-[var(--text-muted)] ml-2">(Cursor)</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-[var(--accent-color)] opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-10 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Configured Providers</h2>
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden">
                
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setProvidersState(s => ({...s, codex: !s.codex}))}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors shadow-sm text-lg">🤖</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Codex</h3>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)]">v0.146.0</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)] font-medium">Authenticated</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <svg className="w-4 h-4 text-[var(--border-color)] group-hover:text-[var(--text-muted)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    {renderToggle(providersState.codex, () => setProvidersState(s => ({...s, codex: !s.codex})))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setProvidersState(s => ({...s, claude: !s.claude}))}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors shadow-sm text-lg">🧠</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Claude</h3>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)]">v2.1.220</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)] font-medium">Authenticated</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <svg className="w-4 h-4 text-[var(--border-color)] group-hover:text-[var(--text-muted)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    {renderToggle(providersState.claude, () => setProvidersState(s => ({...s, claude: !s.claude})))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setProvidersState(s => ({...s, cursor: !s.cursor}))}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors shadow-sm text-lg">⚡</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Cursor</h3>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)] flex items-center gap-1">v2026.07.16-899851b <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] text-[var(--text-muted)] font-medium">Authenticated</p>
                        <span className="text-[9px] font-bold border border-[var(--accent-color)]/30 text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Early Access</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <svg className="w-4 h-4 text-[var(--border-color)] group-hover:text-[var(--text-muted)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    {renderToggle(providersState.cursor, () => setProvidersState(s => ({...s, cursor: !s.cursor})))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setProvidersState(s => ({...s, grok: !s.grok}))}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors shadow-sm text-lg">✖️</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Grok</h3>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)]">v0.2.114</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[12px] text-[var(--text-muted)]"><span className="text-[var(--text-main)] font-semibold">Available</span> — Installed and ready, but authentication could not be verified.</p>
                        <span className="text-[9px] font-bold border border-[var(--accent-color)]/30 text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Early Access</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <svg className="w-4 h-4 text-[var(--border-color)] group-hover:text-[var(--text-muted)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    {renderToggle(providersState.grok, () => setProvidersState(s => ({...s, grok: !s.grok})))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl cursor-pointer group" onClick={() => setProvidersState(s => ({...s, opencode: !s.opencode}))}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors shadow-sm text-lg">🌐</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>OpenCode</h3>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)]">v1.18.9</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)]"><span className="text-[var(--text-main)] font-semibold">Authenticated</span> — 1 upstream provider connected through OpenCode.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <svg className="w-4 h-4 text-[var(--border-color)] group-hover:text-[var(--text-muted)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    {renderToggle(providersState.opencode, () => setProvidersState(s => ({...s, opencode: !s.opencode})))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {activeTab === 'source control' && (
          <div className="animate-in fade-in duration-500 w-full">
            <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Version Control</h2>
            <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden mb-10">
              
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setScState(s => ({...s, git: !s.git}))}>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[#F05032] transition-colors shadow-sm">
                    <svg className="w-5 h-5 text-[#F05032]" viewBox="0 0 128 128" fill="currentColor"><path d="M125.7 58.7L71.3 4.3c-2.8-2.8-7.4-2.8-10.3 0L42.2 23.2l12.7 12.7c3-1 6.5-.4 9.1 2.2 2.8 2.8 3.3 6.9 1.6 10.1l11.6 11.6c3.2-1.7 7.3-1.2 10.1 1.6 3.9 3.9 3.9 10.2 0 14.1-3.9 3.9-10.2 3.9-14.1 0-2.8-2.8-3.3-6.9-1.6-10.1L60.5 54.5v28c1.7 3.2 1.2 7.3-1.6 10.1-3.9 3.9-10.2 3.9-14.1 0-3.9-3.9-3.9-10.2 0-14.1 2.8-2.8 6.9-3.3 10.1-1.6v-28c-3.2-1.7-3.7-5.9-2.1-9.1L40 27l-37.7 37.7c-2.8 2.8-2.8 7.4 0 10.3l54.4 54.4c2.8 2.8 7.4 2.8 10.3 0l58.7-58.7c2.9-2.9 2.9-7.5 0-12z"/></svg>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Git</h3>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)]">git version 2.54.0</span>
                      <span className="text-[9px] font-bold border border-green-500/30 text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider shadow-[0_0_8px_rgba(34,197,94,0.15)]">Available</span>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium">Git is configured and available for code operations.</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  {renderToggle(scState.git, () => setScState(s => ({...s, git: !s.git})))}
                </div>
              </div>

              <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl group">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-orange-500 transition-colors shadow-sm text-[16px]">🥋</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Jujutsu</h3>
                      <span className="text-[9px] font-bold border border-orange-500/30 text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider shadow-[0_0_8px_rgba(249,115,22,0.15)]">Coming Soon</span>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium">Support for Jujutsu is coming soon.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <button className="px-3.5 py-1.5 border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Install <svg className="w-3 h-3 text-[var(--text-muted)] ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <div className="opacity-50 pointer-events-none">
                    {renderToggle(scState.jujutsu, () => {})}
                  </div>
                </div>
              </div>
            </div>

            <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Source Control Providers</h2>
            <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden mb-6">
              
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setScState(s => ({...s, github: !s.github}))}>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--text-main)] transition-colors shadow-sm">
                    <svg className="w-5 h-5 text-[var(--text-main)]" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>GitHub</h3>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)] px-1.5 rounded border border-[var(--border-color)]">gh version 2.96.6 (2026-07-02)</span>
                      <span className="text-[9px] font-bold border border-green-500/30 text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider shadow-[0_0_8px_rgba(34,197,94,0.15)]">Authenticated</span>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium">Authenticated as <span className="text-[var(--text-main)] font-semibold">mxyxyz9</span>. Pull request and issue integrations are enabled.</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  {renderToggle(scState.github, () => setScState(s => ({...s, github: !s.github})))}
                </div>
              </div>

              <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors group">
                <div className="flex items-start gap-4 pr-4">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[#FC6D26] transition-colors shadow-sm text-[#FC6D26]">
                     <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.918 1.263c-.137-.423-.733-.423-.868 0L1.386 9.452.044 13.587c-.121.375.014.789.331 1.023L12 23.054l11.625-8.443c.318-.235.453-.647.33-1.024"/></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>GitLab</h3>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium leading-relaxed">Install the GitLab CLI (<code className="bg-[var(--bg-main)] border border-[var(--border-color)] px-1 py-0.5 rounded text-[11px]">glab</code>) from https://gitlab.com/gitlab-org/cli or your package manager (e.g. <code className="bg-[var(--bg-main)] border border-[var(--border-color)] px-1 py-0.5 rounded text-[11px]">brew install glab</code>).</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <button className="px-3.5 py-1.5 border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Install
                  </button>
                  <div className="opacity-50 pointer-events-none">{renderToggle(scState.gitlab, () => {})}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors group">
                <div className="flex items-start gap-4 pr-4">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[#0078D7] transition-colors shadow-sm text-[#0078D7]">
                     <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.08 8.16L9.67 2h4.52L5.08 8.16zm9.32.48l-2.02 2.05 4.54 7.6 2.06-2.06-4.58-7.59zM22 17.51L17.52 22H2.33l4.57-7.6h10.42L22 17.51z"/></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Azure DevOps</h3>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium leading-relaxed">Install the Azure command-line tools (<code className="bg-[var(--bg-main)] border border-[var(--border-color)] px-1 py-0.5 rounded text-[11px]">az</code>), then enable Azure DevOps support with <code className="bg-[var(--bg-main)] border border-[var(--border-color)] px-1 py-0.5 rounded text-[11px]">az extension add --name azure-devops</code>.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <button className="px-3.5 py-1.5 border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Install
                  </button>
                  <div className="opacity-50 pointer-events-none">{renderToggle(scState.azure, () => {})}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl group cursor-pointer" onClick={() => setScState(s => ({...s, bitbucket: !s.bitbucket}))}>
                <div className="flex items-start gap-4 pr-4">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[#0052CC] transition-colors shadow-sm text-[#0052CC]">
                     <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.32 1h19.36c.64 0 1.13.56 1.05 1.19l-2.48 19.36a1 1 0 01-.99.88H5.06a1 1 0 01-1-.87L1.27 2.19C1.19 1.56 1.68 1 2.32 1zm12.3 12.63H9.49l-.92-5.96h6.77l-1.4 5.96z"/></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Bitbucket</h3>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium leading-relaxed">Set <code className="bg-[var(--bg-main)] border border-[var(--border-color)] px-1 py-0.5 rounded text-[11px]">T3CODE_BITBUCKET_EMAIL</code> and <code className="bg-[var(--bg-main)] border border-[var(--border-color)] px-1 py-0.5 rounded text-[11px]">T3CODE_BITBUCKET_API_TOKEN</code> on the server (use a Bitbucket API token with pull request and repository scopes).</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  {renderToggle(scState.bitbucket, () => setScState(s => ({...s, bitbucket: !s.bitbucket})))}
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="animate-in fade-in duration-500 w-full">
            
            <div className="mb-10 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>This Environment</h2>
              
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden">
                
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group" onClick={() => setConnState(s => ({...s, networkAccess: !s.networkAccess}))}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors shadow-sm">
                      <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Network Access</h3>
                      <p className="text-[12px] text-[var(--text-muted)] font-medium">Limited to this machine.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    {renderToggle(connState.networkAccess, () => setConnState(s => ({...s, networkAccess: !s.networkAccess})))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors group">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0 group-hover:border-[var(--text-main)] transition-colors shadow-sm">
                      <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] ${uiMainFont}`}>Tailscale HTTPS</h3>
                        <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)] font-medium">Install Tailscale to enable secure peer-to-peer HTTPS access.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <button className="px-4 py-2 border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-[var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-2">
                      Install Tailscale
                    </button>
                  </div>
                </div>

              </div>
            </div>

            <div className="mb-4 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Remote Environments</h2>
              <div className="border border-[var(--border-color)] rounded-2xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full p-12 flex flex-col items-center justify-center text-center">
                <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-2 ${uiMainFont}`}>No saved remote environments</h3>
                <p className="text-[13px] text-[var(--text-muted)] mb-8 max-w-md mx-auto font-medium">Connect to remote servers, virtual machines, or other instances of the editor running in different environments.</p>
                <button className="px-5 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:shadow-[0_0_15px_var(--accent-color)] text-[var(--text-main)] hover:text-[var(--accent-color)] rounded-lg text-[13px] font-bold transition-all flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Add environment
                </button>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="animate-in fade-in duration-500 w-full">
            
            <div className="mb-8 w-full">
              <h2 className={`text-[26px] text-[var(--text-main)] mb-5 ${serifClass} lowercase`}>Project Workspace</h2>
              
              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden mb-6 p-5">
                <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Active Project</h3>
                <p className="text-[12px] text-[var(--text-muted)] font-medium mb-5">Current workspace folder and path details.</p>
                
                <h4 className={`text-[18px] font-bold text-[var(--text-main)] mb-2 ${sansClass}`}>Intern-batch-08</h4>
                <div className="inline-block bg-[var(--bg-main)] border border-[var(--border-color)] rounded-md px-3 py-1.5">
                  <code className="text-[11px] text-[var(--text-muted)] font-mono tracking-tight">/Users/rushil.dev/Downloads/Intern-batch-08/Intern-batch-08</code>
                </div>
              </div>

              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden mb-6">
                <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-panel)]">
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Toolbar Tools</h3>
                  <p className="text-[12px] text-[var(--text-muted)] font-medium">Toggle and reorder the tools shown in the project toolbar.</p>
                </div>
                
                <div className="flex flex-col">
                  {workspaceState.tools.map((tool, idx) => (
                    <div key={tool.id} className={`flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors group ${idx !== workspaceState.tools.length - 1 ? 'border-b border-[var(--border-color)]' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="cursor-grab text-[var(--border-color)] group-hover:text-[var(--text-muted)] transition-colors px-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a2 2 0 11-4 0 2 2 0 014 0zM8 12a2 2 0 11-4 0 2 2 0 014 0zM8 18a2 2 0 11-4 0 2 2 0 014 0zM18 6a2 2 0 11-4 0 2 2 0 014 0zM18 12a2 2 0 11-4 0 2 2 0 014 0zM18 18a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        </div>
                        <div>
                          <h4 className={`text-[14px] font-bold text-[var(--text-main)] leading-tight ${sansClass}`}>{tool.title}</h4>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">{tool.sub}</span>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0 pr-2">
                        {renderToggle(tool.active, () => {
                          const newTools = [...workspaceState.tools];
                          newTools[idx].active = !newTools[idx].active;
                          setWorkspaceState(s => ({...s, tools: newTools}));
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden mb-6">
                <div className="p-5 border-b border-[var(--border-color)]">
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Browser Default URL</h3>
                  <p className="text-[12px] text-[var(--text-muted)] font-medium mb-4">The Browser tool loads this URL by default for the active project. Note: If you run a Server Preset that has a Preview URL configured, it will automatically override this default.</p>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <input 
                      type="text" 
                      value={workspaceState.browserUrl}
                      onChange={(e) => setWorkspaceState(s => ({...s, browserUrl: e.target.value}))}
                      className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--text-main)] focus:border-[var(--accent-color)] focus:shadow-[0_0_0_1px_var(--accent-color)] outline-none transition-all shadow-inner"
                    />
                    <button className="px-5 py-2 bg-[var(--accent-color)] text-white rounded-lg text-[13px] font-bold shadow-[0_0_15px_var(--accent-color)] opacity-90 hover:opacity-100 hover:scale-[1.02] transition-all">
                      Save
                    </button>
                  </div>

                  <div className="flex items-start gap-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg p-3">
                    <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-[11.5px] text-[var(--text-muted)] font-medium leading-relaxed">
                      A Server Preset is configured to open a preview in the internal Browser. When you run that preset, its preview URL will override this default.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={() => setWorkspaceState(s => ({...s, resumeStartup: !s.resumeStartup}))}>
                  <div>
                    <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Resume last visited page on startup</h3>
                    <p className="text-[12px] text-[var(--text-muted)] font-medium">When the browser is reopened, load the page you were last on instead of the default URL above.</p>
                  </div>
                  <div className="shrink-0 pl-4">
                    {renderToggle(workspaceState.resumeStartup, () => setWorkspaceState(s => ({...s, resumeStartup: !s.resumeStartup})))}
                  </div>
                </div>
              </div>

              <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-panel)] shadow-sm transition-colors duration-500 w-full overflow-hidden mb-6">
                <div className="p-5 border-b border-[var(--border-color)]">
                  <h3 className={`text-[14.5px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Project Tools</h3>
                  <p className="text-[12px] text-[var(--text-muted)] font-medium mb-5">Manage your project-specific browser tabs, background terminals, or server presets.</p>
                  
                  <div className="flex gap-2 mb-6">
                    {['Browser Tabs', 'Terminal Tabs', 'Server Presets'].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => setWorkspaceState(s => ({...s, projectTab: tab}))}
                        className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all ${
                          workspaceState.projectTab === tab 
                            ? 'bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] shadow-sm' 
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] border border-transparent'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <p className="text-[12px] text-[var(--text-muted)] font-medium mb-5">
                    Add project-specific URLs like Figma, Linear, Notion, or internal tools. Save to add them into the toolbar, then fine-tune placement above in Toolbar Tools.
                  </p>

                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="w-full lg:w-48 flex flex-col gap-2 shrink-0">
                      <button className="w-full py-2 border border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-main)] rounded-lg flex items-center justify-center gap-2 text-[12px] font-bold transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        Add Tab
                      </button>
                      <button className="w-full py-2 px-3 text-left rounded-lg bg-[var(--bg-main)] text-[var(--text-main)] font-bold text-[13px] border border-[var(--border-color)] shadow-sm transition-all">
                        figma
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col gap-5">
                      <h4 className={`text-[16px] font-bold text-[var(--text-main)] ${sansClass}`}>figma</h4>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Label</label>
                        <input 
                          type="text" 
                          value={workspaceState.figmaLabel}
                          onChange={(e) => setWorkspaceState(s => ({...s, figmaLabel: e.target.value}))}
                          className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-inner"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Custom URL</label>
                        <input 
                          type="text" 
                          value={workspaceState.figmaUrl}
                          onChange={(e) => setWorkspaceState(s => ({...s, figmaUrl: e.target.value}))}
                          className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-inner"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)] cursor-pointer group" onClick={() => setWorkspaceState(s => ({...s, figmaShowToolbar: !s.figmaShowToolbar}))}>
                        <p className="text-[12px] text-[var(--text-muted)] font-medium group-hover:text-[var(--text-main)] transition-colors">Show this browser tab in the toolbar once you save it.</p>
                        {renderToggle(workspaceState.figmaShowToolbar, () => setWorkspaceState(s => ({...s, figmaShowToolbar: !s.figmaShowToolbar})))}
                      </div>

                      <div className="flex items-center justify-between py-2 cursor-pointer group" onClick={() => setWorkspaceState(s => ({...s, figmaResume: !s.figmaResume}))}>
                        <div>
                          <h5 className={`text-[13px] font-bold text-[var(--text-main)] mb-1 ${uiMainFont}`}>Resume last visited page</h5>
                          <p className="text-[12px] text-[var(--text-muted)] font-medium group-hover:text-[var(--text-main)] transition-colors">When this tab is reopened, load the page you were last on instead of the custom URL above.</p>
                        </div>
                        <div className="pl-4">
                          {renderToggle(workspaceState.figmaResume, () => setWorkspaceState(s => ({...s, figmaResume: !s.figmaResume})))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-5 border-t border-[var(--border-color)]">
                        <button className="flex items-center gap-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors border border-transparent hover:border-red-500/20">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete Tab
                        </button>
                        
                        <div className="flex items-center gap-3">
                          <button className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)] text-[12px] font-bold transition-colors">
                            Cancel
                          </button>
                          <button className="px-5 py-2 bg-[var(--accent-color)] text-white rounded-lg text-[13px] font-bold shadow-[0_0_15px_var(--accent-color)] opacity-90 hover:opacity-100 hover:scale-[1.02] transition-all">
                            Save Changes
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function App() {
  const [activeFontId, setActiveFontId] = useState(1);
  const activeFont = FONT_CONFIGS.find(f => f.id === activeFontId) || FONT_CONFIGS[0];

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] overflow-hidden">
      <StyleInjector />
      
      {/* App Header (Iteration Controller) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-6 md:px-8 py-5 md:py-6 bg-[#050505] border-b border-[#27272A] gap-4 md:gap-0 z-50">
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 xl:gap-12">
            <div>
              <h1 className="text-[11px] font-bold tracking-[0.25em] text-[#A1A1AA] uppercase mb-1 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                Premium Typography Lab
              </h1>
              <p className="text-[13px] text-[#52525B]">Curated pairings for next-gen interfaces.</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {FONT_CONFIGS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFontId(f.id)}
                  className={`w-9 h-9 rounded-md flex items-center justify-center text-[13px] font-medium transition-all duration-300 ${
                    activeFontId === f.id 
                      ? 'bg-[#FAFAFA] text-[#09090B] shadow-[0_0_15px_rgba(250,250,250,0.3)] scale-105' 
                      : 'border border-[#27272A] text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]'
                  }`}
                >
                  {f.id}
                </button>
              ))}
            </div>
        </div>
        
        <div className="text-left md:text-right">
            <h2 className="text-[15px] font-bold text-[#FAFAFA]">{activeFont.name}</h2>
            <p className="text-[12px] text-[#A1A1AA] mt-0.5">{activeFont.desc}</p>
        </div>
      </div>

      {/* Main Settings Environment */}
      <div className="flex-1 w-full relative overflow-hidden flex flex-col">
        <SettingsReplica activeFont={activeFont} />
      </div>
      
    </div>
  );
}