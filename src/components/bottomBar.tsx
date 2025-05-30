import { FileOutput, Minus } from "lucide-react";
import { Button } from "./ui/button";

export default function BottomBar() {
  return (
    <div className="w-full bg-zinc-900 border-t border-zinc-800 h-56 rounded-t-md">
      <div className="w-full border-b border-zinc-800 flex items-center justify-end px-2">
        <Minus className="text-zinc-500 hover:text-white" />
      </div>
      <div className="w-full border-b border-zinc-800 p-2">
        <Button className="">
          <FileOutput className="size-4" /> Export
        </Button>
      </div>
    </div>
  );
}
