import { useState, useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";

import { AppAtomRegistryProvider } from "./state/atomRegistry";
import { useAppClosing } from "./hooks/useAppClosing";
import { useClientSettings } from "./state/settings";
import { useTheme } from "./hooks/useTheme";
import { CloseScreen } from "./components/CloseScreen";
import type { ClosePhase } from "./components/CloseScreen";
import type { AppRouter } from "./router";

function CloseScreenOverlay({ cleanupDone }: { cleanupDone: boolean }) {
  const [phase, setPhase] = useState<ClosePhase>("idle");
  const clientSettings = useClientSettings();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (cleanupDone) {
      setPhase("closing");
    }
  }, [cleanupDone]);

  const closeStyle = clientSettings.closeLoaderStyle;
  const closePalette = clientSettings.closeLoaderPalette;
  const closeTheme = clientSettings.closeLoaderTheme;

  const effectiveTheme = closeTheme !== "system" ? closeTheme : resolvedTheme;

  return (
    <div className="fixed inset-0 z-[9999]">
      <CloseScreen
        loader={closeStyle}
        palette={closePalette}
        theme={effectiveTheme}
        phase={phase}
        onIntroEnd={() => {
          window.desktopBridge?.notifyReadyToExit?.();
        }}
      />
    </div>
  );
}

export function AppRoot({ router }: { readonly router: AppRouter }) {
  const { isClosing, cleanupDone } = useAppClosing();

  return (
    <AppAtomRegistryProvider>
      <RouterProvider router={router} />
      {isClosing && <CloseScreenOverlay cleanupDone={cleanupDone} />}
    </AppAtomRegistryProvider>
  );
}
