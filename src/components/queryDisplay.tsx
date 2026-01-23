import { useCallback, useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryData } from "@/queryDataProvider";
import Spinner from "./ui/spinner";
import { JsonQueryResult } from "core/connections";
import { Button } from "./ui/button";
import { Check, Copy, FileOutput, X, Save, Undo2 } from "lucide-react";
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

// Types for cell editing
export interface CellEdit {
  rowIndex: number;
  column: string;
  originalValue: any;
  newValue: any;
}

export interface EditedCells {
  [key: string]: CellEdit; // key format: "rowIndex-column"
}

export default function QueryDisplay() {
  const { loadingQuery, queryResult, queryError, currentConnection, runQuery, currentQuery } = useQueryData();
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  );
  const [editedCells, setEditedCells] = useState<EditedCells>({});
  const [isSaving, setIsSaving] = useState(false);

  // Clear edits when query result changes
  useEffect(() => {
    setEditedCells({});
  }, [queryResult]);

  // Handle cell edit
  const handleCellEdit = useCallback((rowIndex: number, column: string, originalValue: any, newValue: any) => {
    const key = `${rowIndex}-${column}`;
    
    setEditedCells(prev => {
      // If the new value matches the original, remove the edit
      if (newValue === originalValue || (newValue === "" && originalValue === null)) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [key]: { rowIndex, column, originalValue, newValue }
      };
    });
  }, []);

  // Discard all edits
  const handleDiscardChanges = useCallback(() => {
    setEditedCells({});
    toast.success("All changes discarded");
  }, []);

  // Helper to format SQL value based on type and database engine
  const formatSqlValue = useCallback((value: any, engine: string): string => {
    if (value === null || value === undefined) {
      return "NULL";
    }
    if (value === "null" || value === "NULL") {
      return "NULL";
    }
    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }
    if (typeof value === "number") {
      return String(value);
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    if (Array.isArray(value)) {
      // Handle arrays - PostgreSQL uses ARRAY syntax or '{...}' format
      if (engine === "Postgres") {
        // Format as PostgreSQL array literal: '{val1,val2,val3}'
        const formattedElements = value.map(v => {
          if (v === null) return "NULL";
          if (typeof v === "string") return `"${v.replace(/"/g, '\\"')}"`;
          return String(v);
        });
        return `'{${formattedElements.join(",")}}'`;
      }
      // For other databases, store as JSON
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    if (typeof value === "object") {
      // Handle JSON/objects
      if (engine === "Postgres") {
        // PostgreSQL JSONB/JSON - use proper casting
        return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
      }
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    // String value - escape single quotes
    return `'${String(value).replace(/'/g, "''")}'`;
  }, []);

  // Helper to quote identifier based on database engine
  const quoteIdentifier = useCallback((identifier: string, engine: string): string => {
    switch (engine) {
      case "MySQL":
        return `\`${identifier}\``;
      case "SQLite":
      case "Postgres":
      default:
        return `"${identifier}"`;
    }
  }, []);

  // Save all edits
  const handleSaveChanges = useCallback(async () => {
    if (!currentConnection || !currentQuery || Object.keys(editedCells).length === 0) return;
    
    setIsSaving(true);
    
    try {
      const engine = currentConnection.engine;
      
      // Group edits by row
      const editsByRow = new Map<number, CellEdit[]>();
      Object.values(editedCells).forEach(edit => {
        const existing = editsByRow.get(edit.rowIndex) || [];
        existing.push(edit);
        editsByRow.set(edit.rowIndex, existing);
      });

      // Try to extract table name from the query (handles schema.table format too)
      // Pattern: FROM [schema.]table - handles quotes, backticks, and no quotes
      const tableMatch = currentQuery.query.match(/FROM\s+["'`]?(\w+)["'`]?(?:\.["'`]?(\w+)["'`]?)?/i);
      if (!tableMatch) {
        toast.error("Could not determine table name from query. Please ensure your query includes a FROM clause.");
        return;
      }
      
      // If there's a second capture group, first is schema, second is table
      // Otherwise, first is the table
      let schemaName: string | undefined;
      let tableName: string;
      if (tableMatch[2]) {
        schemaName = tableMatch[1];
        tableName = tableMatch[2];
      } else {
        tableName = tableMatch[1];
      }
      
      const fullTableName = schemaName 
        ? `${quoteIdentifier(schemaName, engine)}.${quoteIdentifier(tableName, engine)}`
        : quoteIdentifier(tableName, engine);
      
      console.log("Extracted table:", { schemaName, tableName, fullTableName });

      // Get the columns to use for WHERE clause
      const columns = queryResult?.columns || [];
      
      // Generate and execute UPDATE statements for each edited row
      for (const [rowIndex, edits] of editsByRow) {
        const row = queryResult?.rows[rowIndex];
        if (!row) continue;

        // Build SET clause
        const setClauses = edits.map(edit => {
          const quotedCol = quoteIdentifier(edit.column, engine);
          const formattedValue = formatSqlValue(edit.newValue, engine);
          return `${quotedCol} = ${formattedValue}`;
        });

        // Build WHERE clause - prefer using 'id' column if available (likely primary key)
        const whereClauses: string[] = [];
        
        // Common primary key column names to look for
        const pkCandidates = ['id', 'ID', 'Id', '_id', 'uuid', 'UUID'];
        const pkColumn = pkCandidates.find(pk => columns.includes(pk));
        
        if (pkColumn && row[pkColumn] !== null && row[pkColumn] !== undefined) {
          // Use only the primary key for WHERE clause
          const quotedCol = quoteIdentifier(pkColumn, engine);
          const formattedValue = formatSqlValue(row[pkColumn], engine);
          whereClauses.push(`${quotedCol} = ${formattedValue}`);
          console.log("Using primary key column for WHERE:", pkColumn);
        } else {
          // Fall back to using simple columns (skip arrays, objects, dates)
          console.log("No primary key found, using all simple columns for WHERE");
          for (const col of columns) {
            const originalValue = row[col];
            const quotedCol = quoteIdentifier(col, engine);
            
            if (originalValue === null || originalValue === undefined) {
              whereClauses.push(`${quotedCol} IS NULL`);
            } else if (Array.isArray(originalValue)) {
              // Skip arrays - problematic for comparison
              continue;
            } else if (originalValue instanceof Date) {
              // Skip dates - precision issues with comparison
              continue;
            } else if (typeof originalValue === "object") {
              // Skip complex objects
              continue;
            } else {
              const formattedValue = formatSqlValue(originalValue, engine);
              whereClauses.push(`${quotedCol} = ${formattedValue}`);
            }
          }
        }

        if (whereClauses.length === 0) {
          toast.error("Cannot identify row - no usable columns for WHERE clause. Ensure query includes a primary key column.");
          return;
        }

        const updateQuery = `UPDATE ${fullTableName} SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;
        
        console.log("Executing UPDATE:", updateQuery); // Debug logging
        console.log("WHERE values:", whereClauses);
        
        const result = await runQuery(currentConnection, updateQuery);
        console.log("UPDATE result:", result);
        
        if (result && "error" in result) {
          toast.error(`Failed to save row ${rowIndex + 1}: ${result.error}`);
          return;
        }
        
        // Check if any rows were actually updated
        const rowCount = result && "rowCount" in result ? result.rowCount : -1;
        console.log("Rows affected:", rowCount);
        
        if (rowCount === 0) {
          toast.error(`Row ${rowIndex + 1} was not found - WHERE clause may not match. Check console for details.`);
          return;
        }
      }

      // Clear edits and refresh data
      setEditedCells({});
      toast.success(`Successfully saved ${editsByRow.size} row(s)`);
      
      // Re-run the original query to refresh the data
      await runQuery(currentConnection, currentQuery.query);
      
    } catch (error: any) {
      toast.error(`Failed to save changes: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [currentConnection, currentQuery, editedCells, queryResult, runQuery, formatSqlValue, quoteIdentifier]);

  // Keyboard shortcuts for save (Ctrl+S) and discard (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hasEdits = Object.keys(editedCells).length > 0;
      
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && hasEdits) {
        e.preventDefault();
        handleSaveChanges();
      }
      
      // Escape to discard (only if not in an input field)
      if (e.key === "Escape" && hasEdits) {
        const activeElement = document.activeElement;
        const isInInput = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA";
        if (!isInInput) {
          e.preventDefault();
          handleDiscardChanges();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editedCells, handleSaveChanges, handleDiscardChanges]);

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

  const hasEdits = Object.keys(editedCells).length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <QueryToolbar
        queryResult={queryResult}
        totalCount={queryResult?.rowCount ?? 0}
        selectedRecords={selectedRecords}
        onClearSelection={clearSelection}
        hasEdits={hasEdits}
        editCount={Object.keys(editedCells).length}
        onSaveChanges={handleSaveChanges}
        onDiscardChanges={handleDiscardChanges}
        isSaving={isSaving}
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
          editedCells={editedCells}
          onCellEdit={handleCellEdit}
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
  hasEdits,
  editCount,
  onSaveChanges,
  onDiscardChanges,
  isSaving,
}: {
  queryResult: JsonQueryResult | null;
  selectedRecords: any[];
  totalCount: number;
  onClearSelection: () => void;
  hasEdits?: boolean;
  editCount?: number;
  onSaveChanges?: () => void;
  onDiscardChanges?: () => void;
  isSaving?: boolean;
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

        {/* Save/Discard buttons when there are edits */}
        {hasEdits && (
          <>
            <div className="w-px h-4 bg-zinc-700 mx-1" />
            <Button
              size="xs"
              variant="default"
              onClick={onSaveChanges}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSaving ? (
                <Spinner className="size-3" />
              ) : (
                <Save className="size-3" />
              )}
              Save Changes
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={onDiscardChanges}
              disabled={isSaving}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <Undo2 className="size-3" />
              Discard
            </Button>
            <span className="text-xs text-orange-400">
              {editCount} cell{editCount !== 1 ? "s" : ""} modified
            </span>
          </>
        )}
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
  editedCells = {},
  onCellEdit,
}: {
  result: JsonQueryResult | null | undefined;
  selectedRecords: Set<number>;
  onRecordClick: (index: number, shiftKey: boolean, ctrlKey: boolean) => void;
  className?: string;
  editedCells?: EditedCells;
  onCellEdit?: (rowIndex: number, column: string, originalValue: any, newValue: any) => void;
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
                  {result.columns.map((c, index) => {
                    const cellKey = `${virtualRow.index}-${c}`;
                    const isEdited = cellKey in editedCells;
                    const displayValue = isEdited ? editedCells[cellKey].newValue : row[c];
                    
                    return (
                      <EditableCell
                        key={c}
                        value={displayValue}
                        originalValue={row[c]}
                        isEdited={isEdited}
                        width={columnWidths[index + 1]}
                        onEdit={onCellEdit ? (newValue) => onCellEdit(virtualRow.index, c, row[c], newValue) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Editable cell component
function EditableCell({
  value,
  originalValue,
  isEdited,
  width,
  onEdit,
}: {
  value: any;
  originalValue: any;
  isEdited: boolean;
  width: number;
  onEdit?: (newValue: any) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onEdit) return;
    setEditValue(value === null ? "" : String(value));
    setIsEditing(true);
  }, [value, onEdit]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (onEdit) {
      // Convert empty string back to null if original was null
      const newValue = editValue === "" && originalValue === null ? null : editValue;
      onEdit(newValue);
    }
  }, [editValue, originalValue, onEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(value === null ? "" : String(value));
    }
  }, [handleBlur, value]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Stop propagation to prevent row selection when interacting with the cell
    if (isEditing) {
      e.stopPropagation();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div
        className={cn(
          "px-1 py-0.5 flex-shrink-0 text-xs border-r border-zinc-700",
          isEdited && "bg-orange-500/20"
        )}
        style={{ width: `${width}px` }}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs font-mono"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-3 py-1 overflow-hidden text-ellipsis flex-shrink-0 text-xs border-r border-zinc-700 cursor-text",
        isEdited && "bg-orange-500/20 text-orange-200",
        onEdit && "hover:bg-zinc-800/50"
      )}
      style={{ width: `${width}px` }}
      onDoubleClick={handleDoubleClick}
      title={onEdit ? "Double-click to edit" : undefined}
    >
      {formatCell(value)}
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
