import React, {
  createContext,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { JsonQueryResult } from "core/connections";
import { TomeMessage, Connection, Query } from "./types";

interface QueryDataContextValue {
  connections: Connection[];
  currentQuery: Query | null;
  setCurrentQuery: React.Dispatch<SetStateAction<Query | null>>;
  queries: Query[];
  queryResult: JsonQueryResult | null;
  loadingQuery: boolean;
  queryError: string | null;
  connectError: string | null;
  refreshQuery: () => Promise<void>;
  queryMessages: TomeMessage[];
  runQuery: (
    connection: Connection,
    query: string
  ) => Promise<JsonQueryResult | undefined | { error: string }>;
  createQuery: (query: Omit<Query, "id">) => Promise<Query>;
  deleteQuery: (query: Query) => void;
  updateQuery: (updatedQuery: Query) => void;
  refreshQueries: () => void;
  currentConnection: Connection | null;
  setCurrentConnection: React.Dispatch<SetStateAction<Connection | null>>;
  connected: Connection[];
  loadingDb: boolean;
  connect: (db: Connection) => Promise<Connection | null>;
  disconnect: (db: Connection) => Promise<void>;
  setQueryError: React.Dispatch<SetStateAction<string | null>>;
  setConnectError: React.Dispatch<SetStateAction<string | null>>;
}

const QueryDataContext = createContext<QueryDataContextValue | undefined>(
  undefined
);

export function QueryDataProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState<Connection[]>([]);

  const [currentQuery, setCurrentQuery] = useState<Query | null>(null);
  const [currentConnection, setCurrentConnection] = useState<Connection | null>(
    null
  );
  const [connections, setConnections] = useState<Connection[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<JsonQueryResult | null>(null);
  const [queryMessages, setQueryMessages] = useState<TomeMessage[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);

  const runQuery = useCallback(async (conn: Connection, query: string) => {
    setLoadingQuery(true);
    // setQueryResult(null);
    setQueryError(null);
    try {
      const connection = await window.connections.getConnection(conn.id);
      const result = await window.connections.query(connection, query);
      const clonedResult = JSON.parse(JSON.stringify(result));

      setQueryResult(clonedResult);
      return result;
    } catch (error: any) {
      console.error("Failed to run query", error);
      setQueryError(error.message);
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
    const _connection = await window.connections.getConnection(
      _query.connection
    );
    setCurrentConnection(_connection);
    setCurrentQuery(_query);
    refreshQueries();
    return _query;
  }, []);

  const deleteQuery = useCallback(async (queryToDelete: Query) => {
    await window.queries.deleteQuery(queryToDelete.id);
    refreshQueries();
    // If the deleted query was the current query, clear it

    setCurrentQuery((current) => {
      return current?.id === queryToDelete.id ? queries[0] : current;
    });
  }, []);

  const updateQuery = useCallback(async (updatedQuery: Query) => {
    await window.queries.updateQuery(updatedQuery.id, updatedQuery);
    refreshQueries();
  }, []);

  const connect = useCallback(
    async (db: Connection) => {
      // already connected?
      if (connected.some((c) => c.id === db.id)) return db;

      setLoadingDb(true);
      try {
        await window.connections.connect(db); // IPC bridge
        setConnected((prev) => [...prev, db]); // add to list
        setConnectError(null);
        return db;
      } catch (err: any) {
        console.error("DB connect failed:", err);
        setConnectError(err?.message ?? "Unknown error");
        return null;
      } finally {
        setLoadingDb(false);
      }
    },
    [connected]
  );

  const disconnect = useCallback(
    async (db: Connection) => {
      if (!connected.some((c) => c.id === db.id)) return;

      setLoadingDb(true);
      try {
        await window.connections.disconnect(db); // pass which DB to close
        setConnected((prev) => prev.filter((c) => c.id !== db.id));
        setConnectError(null);
      } catch (err: any) {
        console.error("DB disconnect failed:", err);
        setConnectError(err?.message ?? "Unknown error");
      } finally {
        setLoadingDb(false);
      }
    },
    [connected]
  );

  async function getData() {
    const _queries = await window.queries.listQueries();
    setQueries(_queries);
    const _connections = await window.connections.listConnections();
    setConnections(_connections);

    return _queries;
  }

  const refreshQueries = useCallback(async () => {
    await getData();
  }, []);

  async function init() {
    const _queries = await getData();
    if (!currentQuery) {
      setCurrentQuery(_queries[0]);
    }
  }

  useEffect(() => {
    init();
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
      setCurrentQuery,
      queries,
      loadingQuery,
      queryResult,
      refreshQuery,
      runQuery,
      createQuery,
      deleteQuery,
      queryError,
      updateQuery,
      refreshQueries,
      currentConnection,
      queryMessages,
      loadingDb,
      connect,
      disconnect,
      connected,
      setQueryError,
      connectError,
      setConnectError,
      connections,
      setCurrentConnection,
    }),
    [
      queryError,
      connectError,
      setQueryError,
      setConnectError,
      currentQuery,
      connections,
      setCurrentQuery,
      queries,
      loadingQuery,
      queryResult,
      refreshQuery,
      runQuery,
      createQuery,
      deleteQuery,
      updateQuery,
      refreshQueries,
      currentConnection,
      queryMessages,
      loadingDb,
      connect,
      disconnect,
      connected,
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
