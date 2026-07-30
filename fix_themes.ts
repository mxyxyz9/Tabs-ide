import * as fs from 'fs';
let content = fs.readFileSync('tabs-main/apps/web/src/lib/themes.ts', 'utf8');

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
  const regex = new RegExp(`id: "${id}",([\\s\\S]*?)serifClass: ,`);
  content = content.replace(regex, `id: "${id}",$1serifClass: "${cls.serif}",`);
}

fs.writeFileSync('tabs-main/apps/web/src/lib/themes.ts', content);
