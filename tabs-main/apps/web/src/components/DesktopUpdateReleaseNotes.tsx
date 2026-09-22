import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
import type { DesktopUpdateState } from "@tabs/contracts";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function isSafeExternalReleaseNotesUrl(href: string | undefined): href is string {
  if (!href) return false;
  try {
    const protocol = new URL(href).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function ReleaseNotesLink({
  href,
  children,
}: {
  href?: string | undefined;
  children?: ReactNode | undefined;
}) {
  if (!isSafeExternalReleaseNotesUrl(href)) return <span>{children}</span>;
  return (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      onClick={(event) => {
        if (!window.desktopBridge) return;
        event.preventDefault();
        void window.desktopBridge.openExternal(href);
      }}
    >
      {children}
    </a>
  );
}

const releaseNotesMarkdownComponents = { a: ReleaseNotesLink };

export function DesktopUpdateReleaseNotes({ state }: { readonly state: DesktopUpdateState }) {
  const notes = state.releaseNotes?.trim();
  if (!notes) return null;

  const version = state.availableVersion ?? state.downloadedVersion ?? "available";
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="xs" variant="ghost" aria-label={`What's new in Tabs ${version}`}>
            What’s new
          </Button>
        }
      />
      <DialogPopup showCloseButton className="max-w-xl max-h-[85vh] sm:max-h-[80vh]">
        <DialogHeader className="border-b pb-4 pr-10">
          <DialogTitle>What’s new in Tabs {version}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Release notes for the available Tabs update.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel
          scrollFade
          className="max-h-[60vh] space-y-3 px-6 py-4 text-sm leading-relaxed text-muted-foreground [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:mt-4 [&_h3]:mb-1 [&_li]:ml-4 [&_li]:list-disc [&_li]:my-1.5 [&_p]:my-2 [&_strong]:text-foreground"
        >
          <ReactMarkdown components={releaseNotesMarkdownComponents}>{notes}</ReactMarkdown>
        </DialogPanel>
        <DialogFooter variant="bare" className="border-t px-6 py-3">
          <DialogClose
            render={
              <Button size="sm" variant="outline">
                Done
              </Button>
            }
          />
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
