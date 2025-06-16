import { ChevronUp, Maximize, Minus } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import ResizableContainer from "./ui/resizableContainer";
import { useQueryData } from "@/queryDataProvider";
import QueryDisplay, { QueryStatus } from "./queryDisplay";
import { parseBool } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Kbd } from "./toolbar";

export default function BottomBar() {
  const [open, setOpen] = useState(
    parseBool(localStorage.getItem("bottomBarOpen"))
  );
  const { queryResult } = useQueryData();
  function handleOpen() {
    setOpen(!open);
  }

  useEffect(() => {
    if (queryResult) {
      setOpen(true);
    }
  }, [queryResult]);
  useEffect(() => {
    localStorage.setItem("bottomBarOpen", String(open));
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ctrl = e.metaKey
      // cmd = e.ctrlKey
      if (e.key === "o" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <ResizableContainer
      side="top"
      direction="vertical"
      defaultSize={224}
      minSize={50}
      maxSize={800}
      snapThreshold={60}
      isCollapsed={!open}
      onCollapsedChange={(collapsed) => setOpen(!collapsed)}
      className="bg-zinc-900 border-t border-zinc-800 rounded-t-md"
      collapsedSize={32}
    >
      <div className="border-b w-full pl-3 flex justify-between items-center py-1">
        <QueryStatus />
        <div className="flex items-center gap-1 px-1">
          <Tooltip delayDuration={700}>
            <TooltipTrigger>
              <Button
                onClick={handleOpen}
                size="xs"
                variant="ghost"
                className="w-fit has-[>svg]:px-1 h-fit py-1"
              >
                {open ? (
                  <Minus className="text-zinc-500 size-4" />
                ) : (
                  <ChevronUp className="text-zinc-500 size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {open ? "Close" : "Open"} Output <Kbd cmd="⌘O" />
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={700}>
            <TooltipTrigger>
              <Button
                onClick={() => setOpen(true)}
                size="xs"
                variant="ghost"
                className="w-fit has-[>svg]:px-1 h-fit py-1"
              >
                <Maximize className="text-zinc-500 size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Maximize Output <Kbd cmd="⌘M" />
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {open && <QueryDisplay />}
    </ResizableContainer>
  );
}
