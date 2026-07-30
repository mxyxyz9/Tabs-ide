import * as fs from 'fs';

let content = fs.readFileSync('tabs-main/apps/web/src/lib/themes.ts', 'utf8');

// Update interface
content = content.replace(
`  /** Font weight for the sansText spans (CSS value, e.g. "800") */
  specimenWeight: string;
  /** letter-spacing for sansText spans (CSS value, e.g. "-0.05em") */
  specimenTracking: string;
  /** font-style for the serifText span */
  serifStyle: string;
  /** font-weight for the serifText span */
  serifWeight: string;`,
`  /** Tailwind classes for sans elements */
  sansClass: string;
  /** Tailwind classes for serif elements */
  serifClass: string;`
);

// Define classes for each combo
const classes = {
  "system": { sans: "font-bold tracking-tight normal-case", serif: "italic font-normal normal-case" },
  "plaintext": { sans: "font-bold tracking-tight normal-case", serif: "italic font-normal normal-case" },
  "custom": { sans: "font-bold tracking-tight normal-case", serif: "italic font-normal normal-case" },
  "inter-supremacy": { sans: "font-bold tracking-tighter lowercase", serif: "italic font-normal normal-case" },
  "syne-dropped": { sans: "font-extrabold tracking-tighter lowercase", serif: "italic font-normal normal-case" },
  "grotesk-diff": { sans: "font-bold tracking-tight lowercase", serif: "font-normal normal-case" },
  "kerning-crimes": { sans: "font-black tracking-tighter lowercase", serif: "italic font-light normal-case" },
  "liquid-capital": { sans: "font-extrabold tracking-tighter lowercase", serif: "italic font-medium normal-case" },
  "git-blame-era": { sans: "font-black tracking-tighter lowercase", serif: "italic font-normal normal-case" },
  "ink-trap-szn": { sans: "font-black tracking-tighter lowercase", serif: "italic font-medium normal-case" },
  "big-iron": { sans: "font-black tracking-tighter lowercase", serif: "italic font-normal normal-case" },
  "neural-drip": { sans: "font-extrabold tracking-tighter lowercase", serif: "italic font-normal normal-case" },
  "unbounded-swag": { sans: "font-black tracking-tighter lowercase", serif: "italic font-normal normal-case" }
};

for (const [id, cls] of Object.entries(classes)) {
  const regex = new RegExp(
    `    id: "${id}",\\s*` +
    `name: (.*?),\\s*` +
    `desc: (.*?),\\s*` +
    `tag: (.*?),\\s*` +
    `uiFont: (.*?),\\s*` +
    `headingFont: (.*?),\\s*` +
    `sansText: (.*?),\\s*` +
    `serifText: (.*?),\\s*` +
    `(sansText2: (.*?),\\s*)?` +
    `specimenWeight: (.*?),\\s*` +
    `specimenTracking: (.*?),\\s*` +
    `serifStyle: (.*?),\\s*` +
    `serifWeight: (.*?),?`
  );
  
  content = content.replace(regex, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9) => {
    return `    id: "${id}",
    name: ${p1},
    desc: ${p2},
    tag: ${p3},
    uiFont: ${p4},
    headingFont: ${p5},
    sansText: ${p6},
    serifText: ${p7},
${p8 ? `    ${p8}` : ''}    sansClass: "${cls.sans}",
    serifClass: "${cls.serif}",`;
  });
}

fs.writeFileSync('tabs-main/apps/web/src/lib/themes.ts', content);
