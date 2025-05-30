import { Database, SidebarClose } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [open, setOpen] = useState(true);

  function handleOpen() {
    setOpen(!open);
  }

  return (
    <div
      className={cn(
        "relative w-56 bg-zinc-900 border border-zinc-800 h-full rounded-r-md",
        !open && "w-10"
      )}
    >
      {open && (
        <div className="w-full flex justify-between items-center p-1.5 border-b border-zinc-800">
          <div className="text-sm flex gap-1.5 items-center">
            <Database className="size-4" /> Databases
          </div>
        </div>
      )}

      <div className="absolute top-0.5 right-1">
        <Button
          onClick={handleOpen}
          size="xs"
          variant="ghost"
          className="w-fit has-[>svg]:px-1"
        >
          <SidebarClose className="text-zinc-500 size-5" />
        </Button>
      </div>

      {open && <DatabaseList />}
    </div>
  );
}

function DatabaseList() {
  const databases: string[] = ["", ""];
  return (
    <>
      {databases.map(() => (
        <DatabaseListItem />
      ))}
    </>
  );
}

function DatabaseListItem() {
  return <div className="w-full border-b border-zinc-800">test</div>;
}
