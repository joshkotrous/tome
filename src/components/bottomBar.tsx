import { FileOutput, Minus } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import ResizableContainer from "./ui/resizableContainer";

export default function BottomBar() {
  const [open, setOpen] = useState(true);

  function handleOpen() {
    setOpen(!open);
  }

  return (
    <ResizableContainer
      direction="vertical"
      defaultSize={224}
      minSize={60}
      maxSize={800}
      snapThreshold={60}
      isCollapsed={!open}
      onCollapsedChange={(collapsed) => setOpen(!collapsed)}
      className="bg-zinc-900 border border-zinc-800 h-full rounded-r-md"
      collapsedSize={30}
    >
      <div className="border-b  w-full flex justify-end">
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
            <Button className="">
              <FileOutput className="size-4" /> Export
            </Button>
          </div>
        </div>
      )}
    </ResizableContainer>
  );
}
