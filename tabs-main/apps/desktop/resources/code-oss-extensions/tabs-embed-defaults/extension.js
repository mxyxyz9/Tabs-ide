"use strict";

const vscode = require("vscode");

function isWelcomeLikeTab(tab) {
  const label = typeof tab.label === "string" ? tab.label : "";
  return (
    label === "Welcome" ||
    label.startsWith("Walkthrough:") ||
    label.startsWith("Get Started")
  );
}

async function closeWelcomeTabs() {
  const tabsToClose = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (isWelcomeLikeTab(tab)) {
        tabsToClose.push(tab);
      }
    }
  }
  if (tabsToClose.length > 0) {
    await vscode.window.tabGroups.close(tabsToClose, true);
  }
}

function activate(context) {
  const scheduleClose = () => {
    queueMicrotask(() => {
      void closeWelcomeTabs();
    });
  };

  scheduleClose();
  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(() => {
      scheduleClose();
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
