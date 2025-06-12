import { cn } from "@/lib/utils";

interface AnimatedEllipsisProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  speed?: "slow" | "normal" | "fast";
}

export default function AnimatedEllipsis({
  className,
  size = "md",
}: AnimatedEllipsisProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-3xl",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center space-x-0.5",
        sizeClasses[size],
        className
      )}
    >
      <span
        className="animate-bounce"
        style={{ animationDelay: "0ms", animationDuration: "0.75s" }}
      >
        •
      </span>
      <span
        className="animate-bounce"
        style={{ animationDelay: "100ms", animationDuration: "0.75s" }}
      >
        •
      </span>
      <span
        className="animate-bounce"
        style={{ animationDelay: "200ms", animationDuration: "0.75s" }}
      >
        •
      </span>
    </div>
  );
}
