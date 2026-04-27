import { Outlet, createFileRoute } from "@tanstack/react-router";

import { WorkspaceShell } from "../components/WorkspaceShell";
import { SidebarProvider } from "../components/ui/sidebar";

function ChatRouteLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <WorkspaceShell agentsContent={<Outlet />} settingsContent={<Outlet />} />
    </SidebarProvider>
  );
}

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
