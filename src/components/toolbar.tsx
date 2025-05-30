import { Database, FileCode } from "lucide-react";
import { Button } from "./ui/button";

export default function Toolbar() {
  return (
    <div className="w-full h-16 grid grid-cols-[4rem_1fr_1fr_1fr] gap-3 items-center border-b border-zinc-800">
      <div id="mac-stoplight" className="w-10 h-full"></div>
      <div className="flex gap-2">
        <Button size="xs">
          <Database className="size-4" /> Add Database
        </Button>
        <Button size="xs">
          <FileCode className="size-4" /> New Query
        </Button>
      </div>
      <div className="text-center text-xs text-zinc-400 font-mono">
        wayfarer 0.0.0
      </div>
      <div className="text-center"></div>
    </div>
  );
}
