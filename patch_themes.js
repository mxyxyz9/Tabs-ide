const fs = require('fs');
const content = fs.readFileSync('tabs-main/apps/web/src/lib/themes.ts', 'utf8');
let newContent = content
  .replace(/specimenWeight: string;/, 'sansClass: string;')
  .replace(/specimenTracking: string;/, 'serifClass: string;')
  
  // Neutral
  .replace(/specimenWeight: "700",\n\s*specimenTracking: "-0.03em",/g, 'sansClass: "font-bold tracking-tight normal-case",\n    serifClass: "italic font-normal normal-case",')
  .replace(/specimenWeight: "700",\n\s*specimenTracking: "-0.02em",/g, 'sansClass: "font-bold tracking-tight normal-case",\n    serifClass: "italic font-normal normal-case",')

  // Combo 1
  .replace(/specimenWeight: "800",\n\s*specimenTracking: "-0.05em",\n\s*serifStyle: "italic",\n\s*serifWeight: "400",/g, 'sansClass: "font-bold tracking-tighter lowercase",\n    serifClass: "italic font-normal normal-case",')
  
  // We'll just replace the specimenWeight, specimenTracking, serifStyle, serifWeight blocks with sansClass, serifClass!
