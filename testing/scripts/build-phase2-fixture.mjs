import fs from "node:fs/promises";
import path from "node:path";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputDirectory = path.join(repositoryRoot, "testing", "fixtures");
await fs.mkdir(outputDirectory, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("QA Cases");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(3);

sheet.getRange("A1:C1").merge();
sheet.getRange("A1").values = [["Controlled Phase 2 QA Workbook"]];
sheet.getRange("A2:C2").merge();
sheet.getRange("A2").values = [
  ["Includes valid, mismatched, duplicate-ID, and malformed rows for deterministic verification."],
];
sheet.getRange("A3:C9").values = [
  ["Test Case ID", "Scenario", "Test Procedure"],
  ["QA-001", "Open the profile page", '1. Activate link "Profile"\n2. Activate button "Save changes"'],
  ["QA-002", "Use a removed account action", '1. Activate button "Delete account"'],
  ["QA-001", "Duplicate identifier", '1. Activate link "Profile"'],
  ["", "Missing identifier", '1. Activate link "Profile"'],
  ["QA-005", "Missing steps", ""],
  ["QA-003", "Open and save the profile", '1. Activate link "Profile"\n2. Activate button "Save changes"'],
];

sheet.getRange("A1:C1").format = {
  fill: "#064E3B",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  verticalAlignment: "center",
};
sheet.getRange("A2:C2").format = {
  fill: "#ECFDF5",
  font: { color: "#065F46", italic: true },
  wrapText: true,
};
sheet.getRange("A3:C3").format = {
  fill: "#D1FAE5",
  font: { bold: true, color: "#064E3B" },
  borders: { preset: "doubleBottom", style: "medium", color: "#059669" },
};
sheet.getRange("A4:C9").format = {
  wrapText: true,
  verticalAlignment: "top",
  borders: {
    insideHorizontal: { style: "thin", color: "#D1D5DB" },
    bottom: { style: "thin", color: "#D1D5DB" },
  },
};
sheet.getRange("A1:C1").format.rowHeight = 30;
sheet.getRange("A2:C2").format.rowHeight = 34;
sheet.getRange("A3:C3").format.rowHeight = 24;
sheet.getRange("A4:A9").format.columnWidth = 18;
sheet.getRange("B4:B9").format.columnWidth = 34;
sheet.getRange("C4:C9").format.columnWidth = 52;
sheet.getRange("A4:C9").format.rowHeight = 42;

const preview = await workbook.render({
  sheetName: "QA Cases",
  range: "A1:C9",
  scale: 2,
  format: "png",
});
await fs.writeFile(
  path.join(outputDirectory, "phase2-controlled.png"),
  new Uint8Array(await preview.arrayBuffer()),
);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDirectory, "phase2-controlled.xlsx"));

const inspect = await workbook.inspect({
  kind: "table",
  range: "QA Cases!A1:C9",
  include: "values,formulas",
  tableMaxRows: 9,
  tableMaxCols: 3,
});
console.log(inspect.ndjson);
