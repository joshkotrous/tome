import { cn } from "@/lib/utils";
import { Loader } from "lucide-react";

export default function Spinner({ className }: { className?: string }) {
  return <Loader className={cn("size-4 animate-spin", className)} />;
}
