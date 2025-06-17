import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryData } from "@/queryDataProvider";
import Spinner from "./ui/spinner";
import { JsonQueryResult } from "core/database";
import { Button } from "./ui/button";
import { Check, FileOutput, X } from "lucide-react";

export default function QueryDisplay() {
  const { loadingQuery, queryResult, error } = useQueryData();
  return (
    <div className="flex flex-col flex-1 size-full">
      <QueryToolbar />
      {loadingQuery && (
        <div className="flex flex-1 gap-2 items-center justify-center ">
          <Spinner />
          Loading Query...
        </div>
      )}
      {error && <div className="font-mono text-xs p-2">{error}</div>}
      <QueryResultTable result={queryResult} />
    </div>
  );
}

function QueryToolbar() {
  return (
    <div className="w-full flex  justify-between items-center p-1.5 border-b border-zinc-800">
      <div className="text-sm flex gap-1.5 items-center">
        <Button size="xs" className="">
          <FileOutput className="size-4" /> Export
        </Button>
      </div>
    </div>
  );
}

export function QueryStatus() {
  const { loadingQuery, queryResult, error } = useQueryData();
  return (
    <div className="flex gap-1.5">
      {loadingQuery && <Spinner className="" />}
      {error && (
        <div className="flex items-center text-xs text-zinc-400 gap-1.5">
          <X className="size-4 text-red-500" /> Error
        </div>
      )}
      {queryResult && <Check className="size-4 text-green-500" />}
      {queryResult && (
        <div className="text-xs  text-zinc-400">
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
        className={`flex items-center justify-center size-full text-center p-4 text-sm text-zinc-400 ${className}`}
      >
        No data found
      </div>
    );

  return (
    <div
      ref={tableContainerRef}
      className={`h-full text-nowrap overflow-auto text-sm text-zinc-200 font-mono select-none ${className}`}
    >
      <div className="min-w-full">
        {/* Fixed Header */}
        <div className="sticky w-fit top-0 bg-zinc-950 z-10 border-b border-zinc-700 ">
          <div className="flex w-fit text-sm">
            {/* Row number header */}
            <div className="w-9 px-3 py-1 text-left font-semibold whitespace-nowrap flex-shrink-0 border-r border-zinc-700">
              #
            </div>
            {/* Data column headers */}
            {result.columns.map((c) => (
              <div
                key={c}
                className="w-32 px-3 py-1 text-left flex items-center font-semibold whitespace-nowrap flex-shrink-0 text-xs border-zinc-700 border-r"
              >
                {c}
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
                  <div className="w-9 px-3 py-1 text-zinc-400 text-right font-medium flex-shrink-0 border-r border-zinc-800">
                    {virtualRow.index + 1}
                  </div>
                  {/* Data cells */}
                  {result.columns.map((c) => (
                    <div
                      key={c}
                      className="px-3 py-1 overflow-hidden text-ellipsis flex-shrink-0 text-xs border-r border-zinc-700 "
                      style={{ width: "128px" }}
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

function formatCell(value: any) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
