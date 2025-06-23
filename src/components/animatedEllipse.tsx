import { useEffect, useState } from "react";

export function AnimateEllipse({ speed = 500 }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    let count = 0;

    const interval = setInterval(() => {
      count = count >= 3 ? 0 : count + 1;
      setContent(".".repeat(count));
    }, speed);

    return () => clearInterval(interval);
  }, [speed]);

  return <span>{content}</span>;
}
