import { createFileRoute } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useSettings } from "../hooks/useSettings";
import { projectsAtom, threadsAtom } from "../state/threads";
import { useWorkspaceActiveProjectId } from "../state/workspaceShell";
import { useAtomValue } from "@effect/atom-react";

function ChatIndexRouteView() {
  const activeProjectId = useWorkspaceActiveProjectId();
  const projects = useAtomValue(projectsAtom);
  const threads = useAtomValue(threadsAtom);
  const settings = useSettings();
  const { handleNewThread } = useHandleNewThread();

  const activeProject = activeProjectId
    ? (projects.find((project) => project.id === activeProjectId) ?? null)
    : null;
  const projectThreads = activeProject
    ? threads.filter((thread) => thread.projectId === activeProject.id)
    : [];

  if (activeProject && projectThreads.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6 py-10">
        <div className="max-w-3xl text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground/90 sm:text-4xl">
            {`What should we build in ${activeProject.name}?`}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground/60 sm:text-base">
            This project does not have any agent threads yet. Create the first thread when you are
            ready to start working with the project context and workspace tools.
          </p>
          <div className="mt-7 flex justify-center">
            <Button
              size="lg"
              className="rounded-full px-5"
              onClick={() =>
                void handleNewThread(activeProject.id, {
                  envMode: settings.defaultThreadEnvMode,
                })
              }
            >
              Create first thread
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-foreground/70">No agent thread selected</p>
        <p className="mt-2 text-sm text-muted-foreground/50">
          Pick a thread from the current project or create a new one from the Agents panel.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
