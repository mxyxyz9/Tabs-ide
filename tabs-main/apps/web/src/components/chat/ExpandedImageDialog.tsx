import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  copyImageToClipboard,
  downloadMedia,
  type ExpandedImagePreview,
} from "./ExpandedImagePreview";

export interface ExpandedImageDialogProps {
  preview: ExpandedImagePreview;
  onClose: () => void;
  disablePortal?: boolean;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.25;

export const ExpandedImageDialog = memo(function ExpandedImageDialog({
  preview,
  onClose,
  disablePortal = false,
}: ExpandedImageDialogProps) {
  const [imageOffset, setImageOffset] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // Calculate current image index
  const totalImages = preview.images.length;
  const currentIndex = totalImages > 0 ? (preview.index + imageOffset + totalImages) % totalImages : 0;
  const currentItem = preview.images[currentIndex];

  // Reset zoom, pan, and error when navigating to another image
  const resetTransform = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  const navigateImage = useCallback(
    (direction: -1 | 1) => {
      if (totalImages <= 1) return;
      setImageOffset((current) => current + direction);
      resetTransform();
      setHasError(false);
    },
    [resetTransform, totalImages],
  );

  // Restore focus to opener element on close
  const openerRef = useRef<Element | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement;
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        navigateImage(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        navigateImage(1);
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))));
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        resetTransform();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigateImage, onClose, resetTransform]);

  // Pan dragging handlers
  const handleMouseDown = (e: ReactMouseEvent) => {
    if (zoom <= 1.0 || e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging || zoom <= 1.0) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click toggles zoom between 1x and 2x
  const handleDoubleClick = () => {
    if (zoom > 1.0) {
      resetTransform();
    } else {
      setZoom(2.0);
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z + delta).toFixed(2)))));
  };

  // Copy handler
  const handleCopy = useCallback(async () => {
    if (!currentItem) return;
    try {
      await copyImageToClipboard(currentItem.src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy source URL as text if binary copy fails
      try {
        await navigator.clipboard.writeText(currentItem.src);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard failure
      }
    }
  }, [currentItem]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!currentItem) return;
    try {
      await downloadMedia(currentItem.src, currentItem.name);
    } catch {
      // Ignore download failure
    }
  }, [currentItem]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setHasError(false);
    setReloadKey((k) => k + 1);
  }, []);

  if (!currentItem) return null;

  const isVideo = currentItem.type === "video";
  const displaySrc = reloadKey > 0 ? `${currentItem.src}#retry=${reloadKey}` : currentItem.src;
  const BackdropComponent = disablePortal ? "div" : DialogPrimitive.Backdrop;
  const PopupComponent = disablePortal ? "div" : DialogPrimitive.Popup;

  const dialogContent = (
    <>
      <BackdropComponent className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md transition-all duration-200" />
      <PopupComponent
        role="dialog"
        aria-modal="true"
        aria-label={`Expanded preview of ${currentItem.name}`}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 outline-none [-webkit-app-region:no-drag]"
      >
        {/* Top Floating Control Bar */}
          <div
            className="absolute top-4 inset-x-0 mx-auto z-20 flex w-fit items-center gap-1 rounded-xl border border-border/60 bg-background/85 p-1 shadow-xl backdrop-blur-md"
            role="toolbar"
            aria-label="Image actions"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Zoom Out */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={zoom <= MIN_ZOOM || isVideo}
                    onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))))}
                    aria-label="Zoom out"
                  >
                    <MinusIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipPopup side="bottom">Zoom out (-)</TooltipPopup>
            </Tooltip>

            {/* Zoom Percentage / Reset Button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    disabled={isVideo}
                    onClick={resetTransform}
                    className="min-w-12 px-1.5 py-0.5 text-center font-mono text-xs font-semibold tabular-nums text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                }
              />
              <TooltipPopup side="bottom">Reset zoom (0)</TooltipPopup>
            </Tooltip>

            {/* Zoom In */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={zoom >= MAX_ZOOM || isVideo}
                    onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))))}
                    aria-label="Zoom in"
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipPopup side="bottom">Zoom in (+)</TooltipPopup>
            </Tooltip>

            {/* Reset / Fit View */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={zoom === 1.0 && pan.x === 0 && pan.y === 0}
                    onClick={resetTransform}
                    aria-label="Fit to screen"
                  >
                    <RotateCcwIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipPopup side="bottom">Fit to screen</TooltipPopup>
            </Tooltip>

            <div className="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />

            {/* Copy to Clipboard */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={hasError}
                    onClick={() => void handleCopy()}
                    aria-label={copied ? "Copied" : "Copy image"}
                  >
                    {copied ? (
                      <CheckIcon className="size-3.5 text-emerald-500" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                }
              />
              <TooltipPopup side="bottom">{copied ? "Copied!" : "Copy image"}</TooltipPopup>
            </Tooltip>

            {/* Save to Disk */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => void handleSave()}
                    aria-label="Save image to disk"
                  >
                    <DownloadIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipPopup side="bottom">Save image</TooltipPopup>
            </Tooltip>

            <div className="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />

            {/* Close Button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={onClose}
                    aria-label="Close dialog"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipPopup side="bottom">Close (Esc)</TooltipPopup>
            </Tooltip>
          </div>

          {/* Navigation Buttons */}
          {totalImages > 1 && (
            <>
              <button
                type="button"
                onClick={() => navigateImage(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex size-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-background hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateImage(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex size-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-background hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </>
          )}

          {/* Main Media Viewport / Backdrop click closes */}
          <div
            className={cn(
              "relative flex size-full items-center justify-center overflow-hidden select-none",
              zoom > 1.0 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
            )}
            onClick={(e) => {
              // Clicking the backdrop area directly closes the dialog
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            {hasError ? (
              <div
                role="alert"
                className="flex max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/95 p-6 text-center text-card-foreground shadow-2xl backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangleIcon className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Image Unavailable</h3>
                  <p className="text-xs text-muted-foreground">
                    Could not load <span className="font-mono font-medium">{currentItem.name}</span>. The
                    file may have been moved, deleted, or is not accessible.
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={handleRetry}>
                    <RefreshCwIcon className="mr-1.5 size-3.5" />
                    Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleSave()}>
                    <DownloadIcon className="mr-1.5 size-3.5" />
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            ) : isVideo ? (
              <video
                key={displaySrc}
                src={displaySrc}
                controls
                autoPlay
                className="max-h-[84vh] max-w-[90vw] rounded-lg border border-border/60 bg-black object-contain shadow-2xl"
                onError={() => setHasError(true)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                key={displaySrc}
                src={displaySrc}
                alt={currentItem.name}
                draggable={false}
                onError={() => setHasError(true)}
                onDoubleClick={handleDoubleClick}
                onClick={(e) => {
                  e.stopPropagation();
                  if (zoom === 1.0) {
                    setZoom(2.0);
                  }
                }}
                className={cn(
                  "max-h-[84vh] max-w-[90vw] rounded-lg border border-border/60 bg-background/50 object-contain shadow-2xl transition-transform duration-75",
                  zoom <= 1.0 && "cursor-zoom-in",
                )}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              />
            )}
          </div>

          {/* Bottom Info / Counter Pill */}
          <div
            className="absolute bottom-4 inset-x-0 mx-auto z-20 flex w-fit max-w-[min(90vw,36rem)] items-center gap-2 rounded-lg border border-border/60 bg-background/85 px-3 py-1.5 shadow-lg backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate text-xs font-medium text-foreground">
              {currentItem.name}
            </span>
            {totalImages > 1 && (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                ({currentIndex + 1} / {totalImages})
              </span>
            )}
          </div>
        </PopupComponent>
      </>
    );

    if (disablePortal) {
      return dialogContent;
    }

    return (
      <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogPrimitive.Portal keepMounted>
          {dialogContent}
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  });
