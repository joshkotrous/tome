import { useEffect, useState } from "react";
export function AnimateEllipse({ speed = 500 }) {
  const [content, setContent] = useState("");
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => {
        const newCount = prev >= 3 ? 0 : prev + 1;
        setContent(".".repeat(newCount));
        return newCount;
      });
    }, speed); // Use speed param for delay between each dot

    return () => clearInterval(interval);
  }, [speed]);

  return <span>{content}</span>;
}
