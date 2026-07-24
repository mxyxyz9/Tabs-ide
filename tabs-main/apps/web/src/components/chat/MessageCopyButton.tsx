import { memo } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";

export const MessageCopyButton = memo(function MessageCopyButton({ text }: { text: string }) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => copyToClipboard(text)}
      title="Copy message"
      className={cn(
        "flex size-6 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground/40 hover:bg-muted/60 hover:text-foreground/70",
        isCopied && "text-emerald-500",
      )}
    >
      {isCopied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </button>
  );
});
