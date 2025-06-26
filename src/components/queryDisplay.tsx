import { useCallback, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryData } from "@/queryDataProvider";
import Spinner from "./ui/spinner";
import { JsonQueryResult } from "core/connections";
import { Button } from "./ui/button";
import { Check, Copy, FileOutput, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { FaFileCsv, FaFileExcel, FaMarkdown } from "react-icons/fa";
import { toast } from "sonner";

export default function QueryDisplay() {
  const { loadingQuery, queryResult, queryError } = useQueryData();
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  );

  // Handle record selection with click and shift-click
  const handleRecordClick = useCallback(
    (index: number, shiftKey: boolean, ctrlKey: boolean) => {
      if (!queryResult) return;

      setSelectedIndices((prev) => {
        const newSet = new Set(prev);

        if (shiftKey && lastSelectedIndex !== null) {
          // Shift-click: select range
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          for (let i = start; i <= end; i++) {
            newSet.add(i);
          }
        } else if (ctrlKey || (!shiftKey && !ctrlKey && prev.has(index))) {
          // Ctrl-click or clicking already selected: toggle
          if (newSet.has(index)) {
            newSet.delete(index);
          } else {
            newSet.add(index);
          }
        } else {
          // Regular click: select only this record
          newSet.clear();
          newSet.add(index);
        }

        // Update selected records based on new indices
        const newRecords = Array.from(newSet).map(i => queryResult.rows[i]);
        setSelectedRecords(newRecords);

        return newSet;
      });

      setLastSelectedIndex(index);
    },
    [lastSelectedIndex, queryResult]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedRecords([]);
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <QueryToolbar
        queryResult={queryResult}
        totalCount={queryResult?.rowCount ?? 0}
        selectedRecords={selectedRecords}
        onClearSelection={clearSelection}
      />
      {loadingQuery && (
        <div className="flex flex-1 gap-2 items-center justify-center">
          <Spinner />
          Loading Query...
        </div>
      )}
      {queryError && <div className="font-mono text-xs p-2">{queryError}</div>}
      {!loadingQuery && (
        <QueryResultTable
          result={queryResult}
          selectedRecords={selectedIndices}
          onRecordClick={handleRecordClick}
        />
      )}
    </div>
  );
}

function QueryToolbar({
  queryResult,
  selectedRecords,
  totalCount,
  onClearSelection,
}: {
  queryResult: JsonQueryResult | null;
  selectedRecords: any[];
  totalCount: number;
  onClearSelection: () => void;
}) {
  return (
    <div className="w-full flex justify-between items-center p-1.5 border-b border-zinc-800 flex-shrink-0">
      <div className="text-sm flex gap-1.5 items-center">
        <ExportDropdown
          queryResult={queryResult}
          selectedRecords={selectedRecords}
        />

        <CopyDropdown
          queryResult={queryResult}
          selectedRecords={selectedRecords}
        />
      </div>
      {selectedRecords.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            onClick={onClearSelection}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Clear Selection
          </Button>
          <div className="text-xs text-zinc-400">
            {selectedRecords.length} of {totalCount} selected
          </div>
        </div>
      )}
    </div>
  );
}

export function ExportDropdown({
  queryResult,
  selectedRecords,
}: {
  queryResult: JsonQueryResult | null;
  selectedRecords: any[];
}) {
  const convertToCSV = useCallback((data: any[], columns: string[]) => {
    const headers = columns.join(",");
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const value = row[col];
          // Handle values that might contain commas, quotes, or newlines
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    );
    return [headers, ...rows].join("\n");
  }, []);

  // Helper function to convert data to Excel format (simple TSV for Excel compatibility)
  const convertToExcel = useCallback((data: any[], columns: string[]) => {
    const headers = columns.join("\t");
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return "";
          return String(value).replace(/\t/g, " "); // Replace tabs with spaces
        })
        .join("\t")
    );
    return [headers, ...rows].join("\n");
  }, []);

  // Function to trigger file download
  const downloadFile = useCallback(
    (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      URL.revokeObjectURL(url);
    },
    []
  );

  const handleExport = useCallback(
    (format: "csv" | "excel", type: "all" | "selected") => {
      if (!queryResult) {
        console.warn("No query result available for export");
        return;
      }

      // Determine which data to export
      const dataToExport =
        type === "selected" ? selectedRecords : queryResult.rows;
      const columns = queryResult.columns;

      if (dataToExport.length === 0) {
        console.warn("No data to export");
        return;
      }

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:.]/g, "-");
      const recordCount =
        type === "selected" ? selectedRecords.length : queryResult.rowCount;
      const typeLabel = type === "selected" ? "selected" : "all";

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === "csv") {
        content = convertToCSV(dataToExport, columns);
        filename = `query-results-${typeLabel}-${recordCount}-records-${timestamp}.csv`;
        mimeType = "text/csv;charset=utf-8;";
      } else {
        // excel
        content = convertToExcel(dataToExport, columns);
        filename = `query-results-${typeLabel}-${recordCount}-records-${timestamp}.xlsx`;
        mimeType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }

      // Trigger the download
      downloadFile(content, filename, mimeType);
    },
    [queryResult, selectedRecords, convertToCSV, convertToExcel, downloadFile]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="xs" className="bg-zinc-950/50">
          <FileOutput className="size-3" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="!h-fit !p-0 !px-1">
            <DropdownMenuItem>Export All</DropdownMenuItem>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleExport("csv", "all")}>
              <FaFileCsv />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel", "all")}>
              <FaFileExcel />
              Excel
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className="!h-fit !p-0 !px-1"
            disabled={selectedRecords.length === 0}
          >
            <DropdownMenuItem disabled={selectedRecords.length === 0}>
              Export Selected
            </DropdownMenuItem>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleExport("csv", "selected")}>
              <FaFileCsv />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel", "selected")}>
              <FaFileExcel />
              Excel
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CopyDropdown({
  selectedRecords,
  queryResult,
}: {
  queryResult: JsonQueryResult | null;
  selectedRecords: any[];
}) {
  // Helper function to convert data to CSV format
  const convertToCSV = useCallback((data: any[], columns: string[]) => {
    const headers = columns.join(",");
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const value = row[col];
          // Handle values that might contain commas, quotes, or newlines
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    );
    return [headers, ...rows].join("\n");
  }, []);

  // Helper function to convert data to Markdown table format
  const convertToMarkdown = useCallback((data: any[], columns: string[]) => {
    if (data.length === 0) return "";

    // Create header row
    const headerRow = `| ${columns.join(" | ")} |`;

    // Create separator row
    const separatorRow = `| ${columns.map(() => "---").join(" | ")} |`;

    // Create data rows
    const dataRows = data.map((row) => {
      const cells = columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "";
        // Escape pipe characters in cell content
        return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
      });
      return `| ${cells.join(" | ")} |`;
    });

    return [headerRow, separatorRow, ...dataRows].join("\n");
  }, []);

  // Function to copy text to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Use the modern Clipboard API if available
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      return true;
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      return false;
    }
  }, []);

  const handleCopy = useCallback(
    async (format: "csv" | "markdown", type: "all" | "selected") => {
      if (!queryResult) {
        console.warn("No query result available for copying");
        return;
      }

      // Determine which data to copy
      const dataToCopy =
        type === "selected" ? selectedRecords : queryResult.rows;
      const columns = queryResult.columns;

      if (dataToCopy.length === 0) {
        console.warn("No data to copy");
        return;
      }

      let content: string;

      if (format === "csv") {
        content = convertToCSV(dataToCopy, columns);
      } else {
        // markdown
        content = convertToMarkdown(dataToCopy, columns);
      }

      // Copy to clipboard
      const success = await copyToClipboard(content);

      if (success) {
        const recordCount = dataToCopy.length;
        const typeLabel = type === "selected" ? "selected" : "all";
        console.log(
          `Copied ${recordCount} ${typeLabel} records as ${format.toUpperCase()} to clipboard`
        );
        toast.success("Successfully copied to clipboard");
      } else {
        console.error("Failed to copy to clipboard");
      }
    },
    [
      queryResult,
      selectedRecords,
      convertToCSV,
      convertToMarkdown,
      copyToClipboard,
    ]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="xs" className="bg-zinc-950/50">
          <Copy className="size-3" />
          Copy
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="!h-fit !p-0 !px-1">
            <DropdownMenuItem>Copy All</DropdownMenuItem>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleCopy("csv", "all")}>
              <FaFileCsv />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopy("markdown", "all")}>
              <FaMarkdown />
              Markdown
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className="!h-fit !p-0 !px-1"
            disabled={selectedRecords.length === 0}
          >
            <DropdownMenuItem disabled={selectedRecords.length === 0}>
              Copy Selected
            </DropdownMenuItem>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleCopy("csv", "selected")}>
              <FaFileCsv />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopy("markdown", "selected")}
            >
              <FaMarkdown />
              Markdown
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
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
  selectedRecords,
  onRecordClick,
  className = "",
}: {
  result: JsonQueryResult | null | undefined;
  selectedRecords: Set<number>;
  onRecordClick: (index: number, shiftKey: boolean, ctrlKey: boolean) => void;
  className?: string;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Initialize column widths - row number column (36px) + data columns (128px each)
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    if (!result) return [];
    return [36, ...result.columns.map(() => 128)]; // Row number, then data columns
  });

  // Handle column resize
  const handleResize = useCallback((columnIndex: number, delta: number) => {
    setColumnWidths((prev) => {
      const newWidths = [...prev];
      const minWidth = 50;
      const maxWidth = 400;

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
        const column = result.columns[columnIndex - 1]; // Adjust for row number column

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
              className="text-zinc-500 px-3 py-1 text-left font-semibold whitespace-nowrap flex-shrink-0 border-r border-zinc-700 relative"
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
            const isSelected = selectedRecords.has(virtualRow.index);

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
              >
                <div
                  className={cn(
                    "flex w-fit border-b border-zinc-800 text-xs hover:bg-zinc-950/75 transition-all cursor-pointer select-none",
                    isSelected && "bg-zinc-950"
                  )}
                  onClick={(e) =>
                    onRecordClick(
                      virtualRow.index,
                      e.shiftKey,
                      e.ctrlKey || e.metaKey
                    )
                  }
                >
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
      e.stopPropagation(); // Prevent row selection when dragging resize handle
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
      e.stopPropagation(); // Prevent row selection when clicking resize handle

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
      className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-10 ${
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
