import { FileOutput, Minus } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import ResizableContainer from "./ui/resizableContainer";

export default function BottomBar() {
  const [open, setOpen] = useState(true);

  function handleOpen() {
    setOpen(!open);
  }

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
      direction="vertical"
      defaultSize={224}
      minSize={60}
      maxSize={800}
      snapThreshold={60}
      isCollapsed={!open}
      onCollapsedChange={(collapsed) => setOpen(!collapsed)}
      className="bg-zinc-900 border-t border-zinc-800 rounded-t-md"
      collapsedSize={30}
    >
      <div className="border-b w-full flex justify-end">
        <Button
          onClick={handleOpen}
          size="xs"
          variant="ghost"
          className="w-fit has-[>svg]:px-1"
        >
          <Minus className="text-zinc-500 size-5" />
        </Button>
      </div>
      {open && (
        <div className="top-10 w-full flex justify-between items-center p-1.5 border-b border-zinc-800">
          <div className="text-sm flex gap-1.5 items-center">
            <Button size="xs" className="">
              <FileOutput className="size-4" /> Export
            </Button>
          </div>
        </div>
      )}
    </ResizableContainer>
  );
}
