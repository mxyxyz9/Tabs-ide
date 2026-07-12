import { RouterProvider } from "@tanstack/react-router";

import { AppAtomRegistryProvider } from "./state/atomRegistry";
import type { AppRouter } from "./router";

/** Keeps renderer-wide atom state stable across router transitions. */
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <RouterProvider router={router} />
    </AppAtomRegistryProvider>
  );
}
