import React, {
  createContext,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Database, Settings } from "./types";
import { parseBool } from "./lib/utils";

interface AppDataContextValue {
  databases: Database[];
  settings: Settings | null;
  dbDataLoading: boolean;
  settingsDataLoading: boolean;
  refreshDatabases: () => void;
  refreshSettings: () => void;
  agentModeEnabled: boolean;
  setAgentModeEnabled: React.Dispatch<SetStateAction<boolean>>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(
  undefined
);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [dbDataLoading, setDbDataLoading] = useState(false);
  const [settingsDataLoading, setSettingsDataLoading] = useState(false);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Initialize from localStorage, but will be overridden by settings if available
  const [agentModeEnabled, setAgentModeEnabled] = useState(() => {
    try {
      return parseBool(localStorage.getItem("agentModeEnabled"));
    } catch (error) {
      console.warn("Failed to read from localStorage:", error);
      return false;
    }
  });

  // Sync agentModeEnabled to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("agentModeEnabled", String(agentModeEnabled));
    } catch (error) {
      console.warn("Failed to write to localStorage:", error);
    }
  }, [agentModeEnabled]);

  const getDbData = useCallback(async () => {
    setDbDataLoading(true);
    try {
      const dbs = await window.db.listDatabases();
      setDatabases(dbs);
    } catch (error) {
      console.error("Failed to load databases:", error);
    } finally {
      setDbDataLoading(false);
    }
  }, []);

  const getSettingsData = useCallback(async () => {
    setSettingsDataLoading(true);
    try {
      const _settings = await window.settings.getSettings();
      setSettings(_settings);

      // agentModeEnabled is purely client-side, don't touch it here
      // It's managed entirely through localStorage
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setSettingsDataLoading(false);
    }
  }, []);

  // Custom setter for agentModeEnabled (no backend sync needed)
  const setAgentModeEnabledWithSync = useCallback(
    (value: SetStateAction<boolean>) => {
      setAgentModeEnabled(value);
      // No backend sync needed since this is purely client-side
    },
    []
  );

  useEffect(() => {
    getDbData();
    getSettingsData();
  }, [getDbData, getSettingsData]);

  const refreshDatabases = useCallback(async () => {
    await getDbData();
  }, [getDbData]);

  const refreshSettings = useCallback(async () => {
    await getSettingsData();
  }, [getSettingsData]);

  const value = useMemo(
    () => ({
      dbDataLoading,
      settingsDataLoading,
      databases,
      settings,
      refreshDatabases,
      refreshSettings,
      agentModeEnabled,
      setAgentModeEnabled: setAgentModeEnabledWithSync,
    }),
    [
      dbDataLoading,
      settingsDataLoading,
      databases,
      settings,
      refreshDatabases,
      refreshSettings,
      agentModeEnabled,
      setAgentModeEnabledWithSync,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx)
    throw new Error("useAppData must be used inside AppDataContextProvider");
  return ctx;
}
