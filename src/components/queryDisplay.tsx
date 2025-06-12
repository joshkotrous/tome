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
      className={`h-fit text-nowrap overflow-auto text-sm text-zinc-200 font-mono ${className}`}
    >
      <table className="h-full min-w-full border-collapse">
        <thead className="sticky top-0 bg-zinc-800">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c}
                className=" px-3 py-1 border-b border-zinc-700 text-left font-semibold whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="h-full">
          {result.rows.map((row, i) => (
            <tr key={i} className={i % 2 ? "bg-zinc-900/40" : "bg-zinc-900/20"}>
              {result.columns.map((c) => (
                <td
                  key={c}
                  className="px-3 py-1 border-b border-zinc-800 max-w-32 overflow-hidden text-ellipsis"
                >
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: any) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
