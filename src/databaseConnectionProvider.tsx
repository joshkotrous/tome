/* DBConnectionContext.tsx */
import React, {
  createContext,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Database } from "./types";

interface DBConnectionCtxValue {
  connected: Database[]; // ← many, not one
  loading: boolean;
  error: string | null;
  setError: React.Dispatch<SetStateAction<string | null>>;
  connect: (db: Database) => Promise<void>;
  disconnect: (db: Database) => Promise<void>;
}

const DBConnectionContext = createContext<DBConnectionCtxValue | undefined>(
  undefined
);

export const DBConnectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [connected, setConnected] = useState<Database[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(
    async (db: Database) => {
      // already connected?
      if (connected.some((c) => c.id === db.id)) return;

      setLoading(true);
      try {
        await window.db.connect(db); // IPC bridge
        setConnected((prev) => [...prev, db]); // add to list
        setError(null);
      } catch (err: any) {
        console.error("DB connect failed:", err);
        setError(err?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [connected]
  );

  /* ---------- disconnect ----------------------------------------- */
  const disconnect = useCallback(
    async (db: Database) => {
      if (!connected.some((c) => c.id === db.id)) return;

      setLoading(true);
      try {
        await window.db.disconnect(db); // pass which DB to close
        setConnected((prev) => prev.filter((c) => c.id !== db.id));
        setError(null);
      } catch (err: any) {
        console.error("DB disconnect failed:", err);
        setError(err?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [connected]
  );

  useEffect(() => {
    return () => {
      // best-effort close for all live connections
      connected.forEach((db) => window.db.disconnect(db).catch(() => {}));
    };
  }, [connected]);

  const value = useMemo(
    () => ({ connected, loading, error, connect, disconnect, setError }),
    [connected, loading, error, connect, disconnect, setError]
  );

  return (
    <DBConnectionContext.Provider value={value}>
      {children}
    </DBConnectionContext.Provider>
  );
};

export function useDB() {
  const ctx = useContext(DBConnectionContext);
  if (!ctx) throw new Error("useDB must be used inside DBConnectionProvider");
  return ctx;
}
