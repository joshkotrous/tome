import React, {
  createContext,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Database } from "./types";
import { JsonQueryResult } from "core/database";

export type Query = { id: string; connection: Database; query: string };

interface QueryDataContextValue {
  currentQuery: string | null;
  setCurrrentQuery: React.Dispatch<SetStateAction<string | null>>;
  queries: Query[];
  queryResult: JsonQueryResult | null;
  loadingQuery: boolean;
  error: string | null;
  refreshQuery: () => Promise<void>;
  runQuery: (
    query: Query
  ) => Promise<JsonQueryResult | undefined | { error: string }>;
  createQuery: (query: Query) => void;
  deleteQuery: (query: Query) => void;
  updateQuery: (updatedQuery: Query) => void;
}

const QueryDataContext = createContext<QueryDataContextValue | undefined>(
  undefined
);

export function QueryDataProvider({ children }: { children: React.ReactNode }) {
  const [currentQuery, setCurrrentQuery] = useState<string | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<JsonQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runQuery = useCallback(async (query: Query) => {
    setCurrrentQuery(query.id);
    setLoadingQuery(true);
    // setQueryResult(null);
    setError(null);
    try {
      const result = await window.db.query(query.connection, query.query);
      console.log("QUERY RESULT", JSON.stringify(result));
      const clonedResult = JSON.parse(JSON.stringify(result));

      setQueryResult(clonedResult);
      return result;
    } catch (error: any) {
      console.error("Failed to run query", error);
      setError(error.message);
      return { error: error.message };
    } finally {
      setLoadingQuery(false);
    }
  }, []);

  const refreshQuery = useCallback(async () => {
    if (currentQuery) {
      const query = queries.find((i) => i.id === currentQuery);
      if (query) {
        await runQuery(query);
      }
    }
  }, [currentQuery, runQuery]);

  const createQuery = useCallback((query: Query) => {
    setQueries((queries) => [...queries, query]);
    setCurrrentQuery(query.id);
  }, []);

  const deleteQuery = useCallback((queryToDelete: Query) => {
    setQueries((queries) => queries.filter((query) => query !== queryToDelete));
    // If the deleted query was the current query, clear it
    setCurrrentQuery((current) => {
      return current === queryToDelete.id ? null : current;
    });
  }, []);

  const updateQuery = useCallback((updatedQuery: Query) => {
    setQueries((queries) =>
      queries.map((query) =>
        query.id === updatedQuery.id ? updatedQuery : query
      )
    );
  }, []);

  const value = useMemo(
    () => ({
      currentQuery,
      setCurrrentQuery,
      queries,
      loadingQuery,
      queryResult,
      refreshQuery,
      runQuery,
      createQuery,
      deleteQuery,
      error,
      updateQuery,
    }),
    [
      currentQuery,
      setCurrrentQuery,
      queries,
      loadingQuery,
      queryResult,
      refreshQuery,
      runQuery,
      createQuery,
      deleteQuery,
      error,
      updateQuery,
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
