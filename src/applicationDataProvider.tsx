import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Database, Settings } from "./types";

interface AppDataContextValue {
  databases: Database[];
  settings: Settings | null;
  dbDataLoading: boolean;
  settingsDataLoading: boolean;
  refreshDatabases: () => void;
  refreshSettings: () => void;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(
  undefined
);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [dbDataLoading, setDbDataLoading] = useState(false);
  const [settingsDataLoading, setSettingsDataLoading] = useState(false);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const getDbData = useCallback(async () => {
    setDbDataLoading(true);
    const dbs = await window.db.listDatabases().catch((e) => console.error(e));
    if (dbs) {
      setDatabases(dbs);
    }
    setDbDataLoading(false);
  }, []);

  const getSettingsData = useCallback(async () => {
    setSettingsDataLoading(true);
    const _settings = await window.settings
      .getSettings()
      .catch((e) => console.error(e));
    if (_settings) {
      setSettings(_settings);
    }
    setSettingsDataLoading(false);
  }, []);

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
    }),
    [
      dbDataLoading,
      settingsDataLoading,
      databases,
      settings,
      refreshDatabases,
      refreshSettings,
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
