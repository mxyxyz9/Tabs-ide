import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
import type { DesktopUpdateState } from "@tabs/contracts";

import { Button } from "./ui/button";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

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
    <Popover>
      <PopoverTrigger
        render={
          <Button size="xs" variant="ghost" aria-label={`What's new in Tabs ${version}`}>
            What’s new
          </Button>
        }
      />
      <PopoverPopup
        side="bottom"
        align="end"
        className="w-[min(28rem,calc(100vw-2rem))]"
        viewportClassName="max-h-[min(28rem,70vh)]"
      >
        <PopoverTitle>What’s new in Tabs {version}</PopoverTitle>
        <PopoverDescription className="sr-only">
          Release notes for the available Tabs update.
        </PopoverDescription>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-medium [&_h3]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2 [&_strong]:text-foreground">
          <ReactMarkdown components={releaseNotesMarkdownComponents}>{notes}</ReactMarkdown>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
