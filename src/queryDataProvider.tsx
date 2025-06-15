import React, {
  createContext,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { JsonQueryResult } from "core/database";
import { ConversationMessage, Database, Query } from "./types";

interface QueryDataContextValue {
  currentQuery: Query | null;
  setCurrrentQuery: React.Dispatch<SetStateAction<Query | null>>;
  queries: Query[];
  queryResult: JsonQueryResult | null;
  loadingQuery: boolean;
  error: string | null;
  refreshQuery: () => Promise<void>;
  queryMessages: ConversationMessage[];
  runQuery: (
    connection: Database,
    query: string
  ) => Promise<JsonQueryResult | undefined | { error: string }>;
  createQuery: (query: Omit<Query, "id">) => Promise<Query>;
  deleteQuery: (query: Query) => void;
  updateQuery: (updatedQuery: Query) => void;
  refreshQueries: () => void;
  currentConnection: Database | null;
}

const QueryDataContext = createContext<QueryDataContextValue | undefined>(
  undefined
);

export function QueryDataProvider({ children }: { children: React.ReactNode }) {
  const [currentQuery, setCurrrentQuery] = useState<Query | null>(null);
  const [currentConnection, setCurrentConnection] = useState<Database | null>(
    null
  );
  const [connections, setConnections] = useState<Database[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<JsonQueryResult | null>(null);
  const [queryMessages, setQueryMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runQuery = useCallback(async (conn: Database, query: string) => {
    setLoadingQuery(true);
    // setQueryResult(null);
    setError(null);
    try {
      const connection = await window.db.getDatabase(conn.id);
      const result = await window.db.query(connection, query);
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
    if (currentQuery && currentConnection) {
      await runQuery(currentConnection, currentQuery.query);
    }
  }, [currentQuery, runQuery]);

  const createQuery = useCallback(async (query: Omit<Query, "id">) => {
    const _query = await window.queries.createQuery(query);
    const _connection = await window.db.getDatabase(_query.connection);
    setCurrentConnection(_connection);
    setCurrrentQuery(_query);
    refreshQueries();
    return _query;
  }, []);

  const deleteQuery = useCallback(async (queryToDelete: Query) => {
    await window.queries.deleteQuery(queryToDelete.id);
    refreshQueries();
    // If the deleted query was the current query, clear it
    setCurrrentQuery((current) => {
      return current?.id === queryToDelete.id ? null : current;
    });
  }, []);

  const updateQuery = useCallback(async (updatedQuery: Query) => {
    await window.queries.updateQuery(updatedQuery.id, updatedQuery);
    refreshQueries();
  }, []);

  async function getData() {
    const _queries = await window.queries.listQueries();
    setQueries(_queries);
    const _connections = await window.db.listDatabases();
    setConnections(_connections);
  }

  const refreshQueries = useCallback(async () => {
    await getData();
  }, []);

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    async function getQueryData() {
      if (currentQuery) {
        const conn = connections.find((i) => i.id === currentQuery.connection);
        if (conn) {
          setCurrentConnection(conn);
        }
        const _messages = await window.messages.listMessages(
          undefined,
          currentQuery.id
        );
        setQueryMessages(_messages);
      }
    }
    getQueryData();
  }, [currentQuery]);

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
      refreshQueries,
      currentConnection,
      queryMessages,
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
      refreshQueries,
      currentConnection,
      queryMessages,
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
