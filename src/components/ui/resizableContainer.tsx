import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizableContainerProps {
  children: React.ReactNode;
  direction?: "horizontal" | "vertical";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  snapThreshold?: number;
  className?: string;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSizeChange?: (size: number) => void;
  collapsedSize?: number;
}

export default function ResizableContainer({
  children,
  direction = "horizontal",
  defaultSize = 224,
  minSize = 160,
  maxSize = 400,
  snapThreshold,
  className,
  isCollapsed = false,
  onCollapsedChange,
  onSizeChange,
  collapsedSize = 40,
}: ResizableContainerProps) {
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveSnapThreshold = snapThreshold ?? minSize;
  const isHorizontal = direction === "horizontal";

  const updateSize = useCallback(
    (newSize: number) => {
      // Snap to collapsed if below threshold
      if (newSize < effectiveSnapThreshold) {
        onCollapsedChange?.(true);
        setSize(minSize);
        onSizeChange?.(minSize);
        return;
      }

      // Ensure we're expanded if dragging above threshold
      if (isCollapsed) {
        onCollapsedChange?.(false);
      }

      // Clamp size between min and max
      const clampedSize = Math.min(Math.max(newSize, minSize), maxSize);
      setSize(clampedSize);
      onSizeChange?.(clampedSize);
    },
    [
      effectiveSnapThreshold,
      minSize,
      maxSize,
      isCollapsed,
      onCollapsedChange,
      onSizeChange,
    ]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const newSize = isHorizontal
        ? e.clientX - rect.left
        : rect.bottom - e.clientY;

      updateSize(newSize);
    },
    [isHorizontal, updateSize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  // Manage global mouse events and cursor styles
  useEffect(() => {
    if (!isDragging) return;

    const cursor = isHorizontal ? "col-resize" : "row-resize";

    // Set cursor and prevent text selection
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    // Add event listeners
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Cleanup function
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isHorizontal, handleMouseMove, handleMouseUp]);

  // Calculate container styles
  const containerStyle = isCollapsed
    ? isHorizontal
      ? { width: collapsedSize }
      : { height: collapsedSize }
    : isHorizontal
    ? { width: `${size}px` }
    : { height: `${size}px` };

  // Calculate resize handle classes
  const resizeHandleClasses = isHorizontal
    ? cn(
        "absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-zinc-600/50 transition-colors duration-150 z-20",
        isDragging && "bg-zinc-500/70"
      )
    : cn(
        "absolute top-0 left-0 w-full h-2 cursor-row-resize hover:bg-zinc-600/50 transition-colors duration-150 z-20",
        isDragging && "bg-zinc-500/70"
      );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-visible",
        !isDragging && "transition-all duration-100",
        className
      )}
      style={containerStyle}
    >
      {children}
      {/* Resize handle */}
      {!isCollapsed && (
        <div className={resizeHandleClasses} onMouseDown={handleMouseDown} />
      )}
    </div>
  );
}
