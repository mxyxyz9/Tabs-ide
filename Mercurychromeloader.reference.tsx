import React, { useState } from "react";

function LoaderSpinner() {
  return (
    <div className="merc-stage ms-stage">
      <div className="ms-container">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`ms-wrap ms-w${i}`}>
            <div className="ms-dot" />
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
  /* Global Theme & Typography */
  .lab-root {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: "DM Sans Variable", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    transition: background-color 0.4s ease, color 0.4s ease;
    background-color: var(--bg-color);
    color: var(--fg-color);
  }

  /* Light Mode Variables */
  .lab-root.light { 
    --bg-color: #ffffff; 
    --fg-color: #262626;
    --primary: oklch(0.488 0.217 264);
    --card-bg: rgba(255, 255, 255, 0.8);
    --border: rgba(0, 0, 0, 0.08);
    --muted: rgba(0, 0, 0, 0.04);
    --shadow: 0 18px 48px -20px rgba(0, 0, 0, 0.28);
    --white-liquid: #09090b; /* Dark liquid on light bg for contrast */
  }

  /* Dark Mode Variables */
  .lab-root.dark { 
    --bg-color: #0e0e11; 
    --fg-color: #f5f5f5;
    --primary: oklch(0.588 0.217 264);
    --card-bg: rgba(14, 14, 17, 0.8);
    --border: rgba(255, 255, 255, 0.06);
    --muted: rgba(255, 255, 255, 0.04);
    --shadow: 0 18px 48px -20px rgba(0, 0, 0, 0.60);
    --white-liquid: #ffffff; /* Pure white liquid on dark bg */
  }

  /* Glassmorphic UI Panel */
  .lab-controls { 
    display: flex; 
    flex-direction: column; 
    align-items: center;
    gap: 20px; 
    padding: 24px 32px; 
    z-index: 10; 
    width: max-content; 
    margin: 40px auto 0;
    border-radius: 16px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: var(--shadow);
  }

  .lab-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
  
  .lab-btn { 
    padding: 8px 16px; 
    border-radius: 8px; 
    font-size: 13px; 
    font-weight: 500; 
    cursor: pointer; 
    border: 1px solid transparent; 
    transition: all 0.2s; 
    background: var(--muted); 
    color: inherit;
    font-family: inherit;
  }
  .lab-btn:hover { background: var(--border); }
  .lab-btn.active { 
    background: var(--primary); 
    color: #ffffff;
    border-color: transparent;
  }

  /* Central Stage */
  .lab-display { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; gap: 40px; }
  .merc-stage { position: relative; width: 300px; height: 300px; display: flex; align-items: center; justify-content: center; }
  
  /* Permanent Chrome SVG Filter */
  .filter-chrome { filter: url(#goo-chrome); }

  /* Typography */
  .loader-text {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--fg-color);
    opacity: 0.8;
  }

  .ms-container { width: 120px; height: 120px; position: relative; }
  .ms-wrap { position: absolute; inset: 0; }
  
  /* Target dots only for proper liquid merging */
  .ms-dot { 
    background-color: currentColor; 
    position: absolute; 
    top: 0; 
    left: 50%; 
    margin-left: -12px; 
    width: 24px; 
    height: 24px; 
    border-radius: 50%; 
  }
  
  .ms-w1 { animation: mo-spin 2s cubic-bezier(0.6, 0.1, 0.4, 0.9) infinite; }
  .ms-w2 { animation: mo-spin 2s cubic-bezier(0.6, 0.1, 0.4, 0.9) infinite 0.15s; }
  .ms-w3 { animation: mo-spin 2s cubic-bezier(0.6, 0.1, 0.4, 0.9) infinite 0.3s; }
  .ms-w4 { animation: mo-spin 2s cubic-bezier(0.6, 0.1, 0.4, 0.9) infinite 0.45s; }

  @keyframes mo-spin { 100% { transform: rotate(360deg); } }
`;

export default function AwwwardsLoaders() {
  const [isDark, setIsDark] = useState(true);
  const [loaderColor, setLoaderColor] = useState("white"); // "primary" | "white"

  // Determine the CSS color property for the loader based on user selection
  const activeColorValue = loaderColor === "primary" ? "var(--primary)" : "var(--white-liquid)";

  return (
    <div className={`lab-root ${isDark ? 'dark' : 'light'}`}>
      <style>{CSS}</style>
      
      {/* Invisible SVG definition for the 3D chrome liquid physics */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {/* Chrome Specular Filter for the 3D Lighting effect */}
          <filter id="goo-chrome">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feSpecularLighting in="goo" surfaceScale="7" specularConstant="1.2" specularExponent="30" lightingColor="#ffffff" result="specular">
              <fePointLight x="0" y="-100" z="200" />
            </feSpecularLighting>
            <feComposite in="specular" in2="goo" operator="in" result="specularMasked" />
            <feMerge>
              <feMergeNode in="goo" />
              <feMergeNode in="specularMasked" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      { }
      {/* Glassmorphic Developer Controls */}
      <div className="lab-controls">
        <div className="lab-row">
          
          <div className="lab-row" style={{ borderRight: '1px solid var(--border)', paddingRight: '12px' }}>
            <button className={`lab-btn ${!isDark ? 'active' : ''}`} onClick={() => setIsDark(false)}>
              ☀ Light
            </button>
            <button className={`lab-btn ${isDark ? 'active' : ''}`} onClick={() => setIsDark(true)}>
              ☾ Dark
            </button>
          </div>

          <div className="lab-row">
             <button className={`lab-btn ${loaderColor === 'white' ? 'active' : ''}`} onClick={() => setLoaderColor('white')}>
              Pure White
            </button>
            <button className={`lab-btn ${loaderColor === 'primary' ? 'active' : ''}`} onClick={() => setLoaderColor('primary')}>
              Theme Primary
            </button>
          </div>

        </div>
      </div>

      { }
      {/* Central Loading Animation */}
      <div className="lab-display">
        
        {/* Permanently applying filter-chrome */}
        <div className="merc-stage filter-chrome" style={{ color: activeColorValue }}>
          <LoaderSpinner />
        </div>

        {/* Thematic Typography */}
        <div className="loader-text">
          Loading Workspace
        </div>

      </div>
    </div>
  );
}