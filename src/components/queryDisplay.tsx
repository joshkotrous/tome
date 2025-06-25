import { useCallback, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryData } from "@/queryDataProvider";
import Spinner from "./ui/spinner";
import { JsonQueryResult } from "core/connections";
import { Button } from "./ui/button";
import { Check, FileOutput, X } from "lucide-react";

export default function QueryDisplay() {
  const { loadingQuery, queryResult, queryError } = useQueryData();
  return (
    <div className="flex flex-col h-full min-h-0">
      <QueryToolbar />
      {loadingQuery && (
        <div className="flex flex-1 gap-2 items-center justify-center">
          <Spinner />
          Loading Query...
        </div>
      )}
      {queryError && <div className="font-mono text-xs p-2">{queryError}</div>}
      {!loadingQuery && <QueryResultTable result={queryResult} />}
    </div>
  );
}

function QueryToolbar() {
  return (
    <div className="w-full flex justify-between items-center p-1.5 border-b border-zinc-800 flex-shrink-0">
      <div className="text-sm flex gap-1.5 items-center">
        <Button size="xs" className="bg-zinc-950/50">
          <FileOutput className="size-3" /> Export
        </Button>
      </div>
    </div>
  );
}

export function QueryStatus() {
  const { loadingQuery, queryResult, queryError } = useQueryData();
  return (
    <div className="flex gap-1.5">
      {loadingQuery && <Spinner className="" />}
      {queryError && (
        <div className="flex items-center text-xs text-zinc-400 gap-1.5">
          <X className="size-4 text-red-500" /> Error
        </div>
      )}
      {queryResult && <Check className="size-4 text-green-500" />}
      {queryResult && (
        <div className="text-xs text-zinc-400">
          {queryResult?.rowCount} results
        </div>
      )}
    </div>
  );
}

export function QueryResultTable({
  result,
  className = "",
}: {
  result: JsonQueryResult | null | undefined;
  className?: string;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Initialize column widths - row number column (36px) + data columns (128px each)
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    if (!result) return [];
    return [36, ...result.columns.map(() => 128)]; // First is row number column
  });

  // Handle column resize
  const handleResize = useCallback((columnIndex: number, delta: number) => {
    setColumnWidths((prev) => {
      const newWidths = [...prev];
      const minWidth = 50; // Minimum column width
      const maxWidth = 400; // Maximum column width

      newWidths[columnIndex] = Math.max(
        minWidth,
        Math.min(maxWidth, prev[columnIndex] + delta)
      );
      return newWidths;
    });
  }, []);

  // Calculate optimal column width based on content
  const calculateOptimalWidth = useCallback(
    (columnIndex: number) => {
      if (!result) return 128;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return 128;

      // Set font to match table font
      ctx.font =
        '12px ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace';

      let maxWidth = 0;

      if (columnIndex === 0) {
        // Row number column - check row count digits
        const rowCount = result.rows.length;
        const maxRowText = rowCount.toString();
        maxWidth = ctx.measureText(maxRowText).width + 24; // padding
      } else {
        const column = result.columns[columnIndex - 1];

        // Measure header text
        maxWidth = Math.max(maxWidth, ctx.measureText(column).width + 24);

        // Sample up to 100 rows for performance
        const sampleSize = Math.min(100, result.rows.length);
        for (let i = 0; i < sampleSize; i++) {
          const cellValue = formatCell(result.rows[i][column]);
          const cellText = cellValue?.toString() || "";
          maxWidth = Math.max(maxWidth, ctx.measureText(cellText).width + 24);
        }
      }

      // Add some padding and constrain to reasonable bounds
      return Math.max(50, Math.min(400, maxWidth + 16));
    },
    [result]
  );

  // Handle auto-resize for a specific column
  const handleAutoResize = useCallback(
    (columnIndex: number) => {
      const optimalWidth = calculateOptimalWidth(columnIndex);
      setColumnWidths((prev) => {
        const newWidths = [...prev];
        newWidths[columnIndex] = optimalWidth;
        return newWidths;
      });
    },
    [calculateOptimalWidth]
  );

  // Create virtualizer for table rows - must be called before early returns
  const rowVirtualizer = useVirtualizer({
    count: result?.rows.length || 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33, // Estimated row height in pixels
    overscan: 10,
  });

  if (!result) return null;
  if (result.rowCount === 0)
    return (
      <div
        className={`flex items-center justify-center flex-1 text-center p-4 text-sm text-zinc-400 ${className}`}
      >
        No data found
      </div>
    );

  return (
    <div
      ref={tableContainerRef}
      className={`pb-9 flex-1 min-h-0 text-nowrap overflow-auto text-sm text-zinc-200 font-mono ${className}`}
    >
      <div className="min-w-full">
        {/* Fixed Header */}
        <div className="sticky w-fit top-0 bg-zinc-950 z-10 border-b border-zinc-700">
          <div className="flex w-fit text-sm">
            {/* Row number header */}
            <div
              className="px-3 py-1 text-left font-semibold whitespace-nowrap flex-shrink-0 border-r border-zinc-700 relative"
              style={{ width: `${columnWidths[0]}px` }}
            >
              #
              <ResizeHandle
                onResize={(delta) => handleResize(0, delta)}
                onAutoResize={() => handleAutoResize(0)}
                className="right-0"
              />
            </div>
            {/* Data column headers */}
            {result.columns.map((c, index) => (
              <div
                key={c}
                className="px-3 py-1 text-left flex items-center font-semibold whitespace-nowrap flex-shrink-0 text-xs border-zinc-700 border-r text-nowrap overflow-hidden relative"
                style={{ width: `${columnWidths[index + 1]}px` }}
              >
                {c}
                <ResizeHandle
                  onResize={(delta) => handleResize(index + 1, delta)}
                  onAutoResize={() => handleAutoResize(index + 1)}
                  className="right-0"
                />
              </div>
            ))}
          </div>
        </div>
        {/* Virtualized Rows */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = result.rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={
                  virtualRow.index % 2 ? "bg-zinc-900/40" : "bg-zinc-900/20"
                }
              >
                <div className="flex w-fit border-b border-zinc-800 text-xs hover:bg-zinc-950/75 transition-all">
                  {/* Row number cell */}
                  <div
                    className="bg-zinc-950/50 px-3 py-1 text-zinc-400 text-right font-medium flex-shrink-0 border-r border-zinc-800"
                    style={{ width: `${columnWidths[0]}px` }}
                  >
                    {virtualRow.index + 1}
                  </div>
                  {/* Data cells */}
                  {result.columns.map((c, index) => (
                    <div
                      key={c}
                      className="px-3 py-1 overflow-hidden text-ellipsis flex-shrink-0 text-xs border-r border-zinc-700"
                      style={{ width: `${columnWidths[index + 1]}px` }}
                    >
                      {formatCell(row[c])}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Resize handle component
function ResizeHandle({
  onResize,
  onAutoResize,
  className = "",
}: {
  onResize: (delta: number) => void;
  onAutoResize: () => void;
  className?: string;
}) {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startXRef.current;
        onResize(delta);
        startXRef.current = e.clientX;
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (clickTimeoutRef.current) {
        // Double click detected
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        onAutoResize();
      } else {
        // First click - wait for potential second click
        clickTimeoutRef.current = setTimeout(() => {
          clickTimeoutRef.current = null;
        }, 300);
      }
    },
    [onAutoResize]
  );

  return (
    <div
      className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors ${
        isResizing ? "bg-blue-500" : ""
      } ${className}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{ transform: "translateX(50%)" }}
    />
  );
}

function formatCell(value: any) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
