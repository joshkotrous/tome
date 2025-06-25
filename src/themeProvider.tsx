import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  PropsWithChildren,
} from "react";

type Theme = "light" | "dark";
type ThemeCtx = { theme: Theme; toggleTheme: () => void };

const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  // 1  initial value: saved → OS preference → light
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // 2  side-effects before paint to prevent flicker
  useLayoutEffect(() => {
    const body = document.body;
    const isDark = theme === "dark";

    body.classList.toggle("dark", isDark); // Tailwind looks for .dark anywhere in the ancestry
    body.style.colorScheme = isDark ? "dark" : "light"; // native widgets
    localStorage.setItem("theme", theme);

    // (optional) inform Electron main process
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// handy hook
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside <ThemeProvider>");
  return ctx;
}
