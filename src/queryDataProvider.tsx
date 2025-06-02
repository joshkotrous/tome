import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Database } from "./types";

type Query = { connection: Database; query: string };

interface QueryDataContextValue {
  currentQuery: Query | null;
  queries: Query[];
  queryResult: string[];
  loadingQuery: boolean;
  refreshQuery: () => Promise<void>;
  runQuery: (query: Query) => Promise<void>;
  createQuery: (query: Query) => void;
}

const QueryDataContext = createContext<QueryDataContextValue | undefined>(
  undefined
);

export function QueryDataProvider({ children }: { children: React.ReactNode }) {
  const [currentQuery, setCurrrentQuery] = useState<Query | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<string[]>([]);

  const runQuery = useCallback(async (query: Query) => {
    setCurrrentQuery(query);
    setLoadingQuery(true);
    const result = [""];
    setQueryResult(result);
    setLoadingQuery(false);
  }, []);

  const refreshQuery = useCallback(async () => {
    if (currentQuery) {
      await runQuery(currentQuery);
    }
  }, [currentQuery, runQuery]);

  const createQuery = useCallback((query: Query) => {
    setQueries((queries) => [...queries, query]);
    setCurrrentQuery(query);
  }, []);

  const value = useMemo(
    () => ({
      currentQuery,
      queries,
      loadingQuery,
      queryResult,
      refreshQuery,
      runQuery,
      createQuery,
    }),
    [
      currentQuery,
      queries,
      loadingQuery,
      queryResult,
      refreshQuery,
      runQuery,
      createQuery,
    ]
  );

  return (
    <QueryDataContext.Provider value={value}>
      {children}
    </QueryDataContext.Provider>
  );
}

export function useQueryData() {
  const ctx = useContext(QueryDataContext);
  if (!ctx) {
    throw new Error(
      "useQueryData must be used inside QueryDataContextProvider"
    );
  }
  return ctx;
}
