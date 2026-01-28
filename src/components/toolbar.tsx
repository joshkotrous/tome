import {
  DatabaseIcon,
  FileCode,
  Loader2,
  LucideProps,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import AddDatabaseButton, { AddDatabaseDialog } from "./addDatabaseButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import React, { SetStateAction, useEffect, useState } from "react";
import {
  AIProvider,
  Connection,
  Query,
  Settings as SettingsType,
} from "@/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { useAppData } from "@/applicationDataProvider";
import { useQueryData } from "@/queryDataProvider";
import TomeLogo from "./logos/tome";
import OpenAILogo from "./logos/openai";
import AnthropicLogo from "./logos/anthropic";
export default function Toolbar() {
  const { agentModeEnabled } = useAppData();
  return (
    <div className="w-full h-14 grid grid-cols-[4rem_1fr_1fr_1fr] gap-3 items-center border-b border-zinc-800 pr-3">
      <div id="mac-stoplight" className="w-10 h-full"></div>
      <div className="flex gap-2">
        <AddDatabaseButton />
        {!agentModeEnabled && <NewQueryButton />}
      </div>

      <div className="flex justify-center">
        <TomeLogo className="size-14" />
      </div>

      <div className="flex gap-2 justify-end">
        <NavCmdButton />
        <SettingsDialog>
          <div>
            <Button size="xs">
              <Settings className="size-4" />
            </Button>
          </div>
        </SettingsDialog>
      </div>
    </div>
  );
}

export function NewQueryButton({
  size = "xs",
}: {
  size?: "default" | "xs" | "sm" | "lg" | "icon" | null | undefined;
}) {
  const { connected } = useQueryData();
  const { createQuery } = useQueryData();

  const [selectConnectionOpen, setSelectConnectionOpen] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);
  function handleNewQuery() {
    if (connected.length === 0) {
      setSelectConnectionOpen(true);
    }

    if (connected.length === 1) {
      const newQuery: Omit<Query, "id"> = {
        connection: connected[0].id,
        query: "",
        title: "untitled",
        createdAt: new Date(),
      };
      createQuery(newQuery);
    }

    if (connected.length > 1) {
      setOnlyActive(true);
      setSelectConnectionOpen(true);
    }
  }

  return (
    <>
      <SelectConnectionDialog
        onlyActiveConnections={onlyActive}
        open={selectConnectionOpen}
        onOpenChange={setSelectConnectionOpen}
      />
      <Button onClick={() => handleNewQuery()} size={size}>
        <FileCode className="size-4" /> New Query
      </Button>
    </>
  );
}

function SelectConnectionDialog({
  setSelected,
  open,
  onOpenChange,
  children,
  onlyActiveConnections,
}: {
  onlyActiveConnections?: boolean;
  setSelected?: React.Dispatch<SetStateAction<Connection | null>>;
  open: boolean;
  onOpenChange: React.Dispatch<SetStateAction<boolean>>;
  children?: React.ReactNode;
}) {
  const { databases } = useAppData();
  const { connected } = useQueryData();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className=" max-w-2xl">
        <DialogTitle>Select Connection</DialogTitle>
        {onlyActiveConnections && (
          <ConnectionList
            connections={connected}
            setSelected={setSelected}
            onOpenChange={onOpenChange}
          />
        )}
        {!onlyActiveConnections && (
          <ConnectionList
            setSelected={setSelected}
            onOpenChange={onOpenChange}
            connections={databases}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConnectionList({
  connections,
  setSelected,
  onOpenChange,
}: {
  connections: Connection[];
  setSelected?: React.Dispatch<SetStateAction<Connection | null>>;
  onOpenChange: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { connect } = useQueryData();

  const { createQuery, setCurrentQuery } = useQueryData();

  return (
    <div className="border rounded-md overflow-hidden">
      {connections.map((i) => (
        <div
          key={i.id}
          className="hover:bg-zinc-800 transition-all p-2"
          onClick={async () => {
            if (setSelected) {
              setSelected(i);
            }
            onOpenChange(false);
            connect(i);

            const newQuery = {
              connection: i.id,
              query: "",
              title: "untitled",
              createdAt: new Date(),
            };

            const _query = await createQuery(newQuery);
            setCurrentQuery(_query);
          }}
        >
          {i.name}
        </div>
      ))}
    </div>
  );
}

function SettingsDialog({
  children,
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: React.Dispatch<SetStateAction<boolean>>;
  children?: React.ReactNode;
}) {
  const [selectedPage, setSelectedPage] =
    useState<"AI Features" | "Advanced">("AI Features");

  const pageOptions: {
    title: "AI Features" | "Advanced";
    icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref">>;
  }[] = [
    {
      title: "AI Features",
      icon: Sparkles,
    },
    {
      title: "Advanced",
      icon: Wrench,
    },
  ];

  function displayPage(page: "AI Features" | "Advanced") {
    switch (page) {
      case "AI Features":
        return <AIFeaturesSettingsPage />;
      case "Advanced":
        return <AdvancedSettingsPage />;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className=" max-w-2xl">
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Manage your workspace settings</DialogDescription>
        <div className="flex size-full gap-4">
          <div className="h-full  flex flex-col w-36 items-end border-r pr-2 gap-2">
            {pageOptions.map((i) => (
              <Button
                key={i.title}
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPage(i.title)}
                className={cn(
                  `w-full flex gap-1.5 items-center justify-end`,
                  i.title === selectedPage && "bg-zinc-800"
                )}
              >
                <i.icon className="size-4" /> {i.title}
              </Button>
            ))}
          </div>
          {displayPage(selectedPage)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AIFeaturesSettingsPage({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const { refreshSettings } = useAppData();
  const [updating, setUpdating] = useState(false);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [initialSettings, setInitialSettings] = useState<SettingsType | null>(
    null
  );

  useEffect(() => {
    async function getData() {
      const _settings = await window.settings.getSettings();
      setSettings(_settings);
      setInitialSettings(_settings);
    }
    getData();
  }, []);

  async function saveSettings(updated: SettingsType) {
    setUpdating(true);
    const _settings = await window.settings.updateSettings(updated);
    setSettings(_settings);
    setInitialSettings(_settings);
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    setUpdating(false);
    refreshSettings();
    if (onComplete) {
      onComplete();
    }
  }

  // Helper function to check if settings have changed
  const hasChanges = () => {
    if (!initialSettings || !settings) return false;
    return JSON.stringify(initialSettings) !== JSON.stringify(settings);
  };

  if (!settings) {
    return (
      <div className="pt-1 space-y-4 size-full h-64 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-1 space-y-4 w-full">
      <h2 className="font-semibold text-xl">AI Features</h2>
      <div className="space-y-3">
        <div className="flex gap-4 items-center text-sm text-zinc-400">
          Enabled
          <Switch
            checked={settings.aiFeatures.enabled}
            onCheckedChange={(enabled) =>
              setSettings((prev) => ({
                ...prev!,
                aiFeatures: {
                  ...prev!.aiFeatures,
                  enabled,
                },
              }))
            }
          />
        </div>

        {settings.aiFeatures.enabled && (
          <>
            <ConfigureProvider
              provider="Open AI"
              settings={settings}
              onSettingsChange={setSettings}
            />
            <ConfigureProvider
              provider="Anthropic"
              settings={settings}
              onSettingsChange={setSettings}
            />
            <ConfigureLocalModel
              settings={settings}
              onSettingsChange={setSettings}
            />
          </>
        )}

        <Button
          disabled={updating || !hasChanges()}
          onClick={async () => await saveSettings(settings)}
          variant="secondary"
          className="w-full"
        >
          {updating ? (
            <>
              Saving... <Loader2 className="size-3 animate-spin ml-2" />
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

function AdvancedSettingsPage() {
  const { refreshSettings } = useAppData();
  const [updating, setUpdating] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [initialSettings, setInitialSettings] = useState<SettingsType | null>(
    null
  );

  useEffect(() => {
    async function getData() {
      const _settings = await window.settings.getSettings();
      setSettings(_settings);
      setInitialSettings(_settings);
    }
    getData();
  }, []);

  async function saveSettings(updated: SettingsType) {
    setUpdating(true);
    const _settings = await window.settings.updateSettings(updated);
    setSettings(_settings);
    setInitialSettings(_settings);
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    setUpdating(false);
    refreshSettings();
  }

  async function handleCheckForUpdates() {
    setCheckingUpdates(true);
    try {
      const updateInfo = await window.updates.checkForUpdates();

      if (updateInfo.status === "available") {
        toast.info(`Update v${updateInfo.latestVersion} available!`, {
          description: `You're currently on v${updateInfo.currentVersion}`,
          duration: 10000,
          action: {
            label: "Download Update",
            onClick: async () => {
              const toastId = toast.loading(
                `Downloading update v${updateInfo.latestVersion}...`,
                { description: "Starting download..." }
              );

              // Set up progress listener
              const unsubscribeProgress = window.updates.onDownloadProgress(
                (progress) => {
                  toast.loading(
                    `Downloading update... ${progress.percent.toFixed(0)}%`,
                    {
                      id: toastId,
                      description: `${(progress.transferred / 1024 / 1024).toFixed(1)} MB / ${(progress.total / 1024 / 1024).toFixed(1)} MB`,
                    }
                  );
                }
              );

              // Set up status listener
              const unsubscribeStatus = window.updates.onUpdateStatus(
                (data) => {
                  if (data.status === "downloaded") {
                    toast.dismiss(toastId);
                    toast.success(
                      `Update v${data.latestVersion} ready to install!`,
                      {
                        description:
                          "The update will be installed when you restart the app.",
                        duration: 0,
                        action: {
                          label: "Restart Now",
                          onClick: async () => {
                            await window.updates.installUpdate();
                          },
                        },
                      }
                    );
                    unsubscribeProgress();
                    unsubscribeStatus();
                  } else if (data.status === "error") {
                    toast.dismiss(toastId);
                    toast.error("Update failed", {
                      description: data.error || "An error occurred",
                      duration: 5000,
                    });
                    unsubscribeProgress();
                    unsubscribeStatus();
                  }
                }
              );

              await window.updates.downloadUpdate();
            },
          },
        });
      } else if (updateInfo.status === "error") {
        toast.error("Failed to check for updates", {
          description: updateInfo.error || "Please try again later",
          duration: 3000,
        });
      } else {
        toast.success("You're up to date!", {
          description: `Current version: v${updateInfo.currentVersion}`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      toast.error("Failed to check for updates", {
        description: "Please try again later",
        duration: 3000,
      });
    } finally {
      setCheckingUpdates(false);
    }
  }

  const hasChanges = () => {
    if (!initialSettings || !settings) return false;
    return JSON.stringify(initialSettings) !== JSON.stringify(settings);
  };

  if (!settings) {
    return (
      <div className="pt-1 space-y-4 size-full h-64 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-1 space-y-4 w-full">
      <h2 className="font-semibold text-xl">Advanced</h2>
      <div className="space-y-3">
        <div className="bg-zinc-900 p-4 px-4 space-y-2 rounded-md">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Auto Updates</span>
              <span className="text-zinc-400 text-sm">
                Automatically download and install updates when available
              </span>
            </div>
            <Switch
              checked={settings.autoUpdates ?? true}
              onCheckedChange={(autoUpdates) =>
                setSettings((prev) => ({
                  ...prev!,
                  autoUpdates,
                }))
              }
            />
          </div>
        </div>

        <Button
          disabled={checkingUpdates}
          onClick={handleCheckForUpdates}
          variant="outline"
          className="w-full"
        >
          {checkingUpdates ? (
            <>
              Checking... <Loader2 className="size-3 animate-spin ml-2" />
            </>
          ) : (
            <>
              <RefreshCw className="size-4 mr-2" />
              Check for Updates
            </>
          )}
        </Button>

        <Button
          disabled={updating || !hasChanges()}
          onClick={async () => await saveSettings(settings)}
          variant="secondary"
          className="w-full"
        >
          {updating ? (
            <>
              Saving... <Loader2 className="size-3 animate-spin ml-2" />
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

function ConfigureProvider({
  provider,
  settings,
  onSettingsChange,
}: {
  provider: AIProvider;
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
}) {
  const providerKey = provider === "Open AI" ? "openai" : "anthropic";
  const providerSettings = settings.aiFeatures.providers[providerKey];

  const handleToggle = (enabled: boolean) => {
    onSettingsChange({
      ...settings,
      aiFeatures: {
        ...settings.aiFeatures,
        providers: {
          ...settings.aiFeatures.providers,
          [providerKey]: {
            ...providerSettings,
            enabled,
          },
        },
      },
    });
  };

  const handleApiKeyChange = (apiKey: string) => {
    onSettingsChange({
      ...settings,
      aiFeatures: {
        ...settings.aiFeatures,
        providers: {
          ...settings.aiFeatures.providers,
          [providerKey]: {
            ...providerSettings,
            apiKey,
          },
        },
      },
    });
  };

  return (
    <div className="bg-zinc-900 p-4 px-4 space-y-2 rounded-md transition-all">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AIProviderLogo
            className="size-5 text-zinc-400"
            provider={provider}
          />
          {provider}
        </div>
        <Switch
          checked={providerSettings.enabled}
          onCheckedChange={handleToggle}
        />
      </div>
      {providerSettings.enabled && (
        <div>
          <p className="text-zinc-400 text-xs ml-1 py-2">API Key</p>
          <Input
            type="password"
            placeholder="Enter your API key..."
            value={providerSettings.apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function ConfigureLocalModel({
  settings,
  onSettingsChange,
}: {
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
}) {
  const [newModelId, setNewModelId] = useState("");
  const localModel = settings.aiFeatures.localModel ?? { url: "", models: [] };

  const handleUrlChange = (url: string) => {
    onSettingsChange({
      ...settings,
      aiFeatures: {
        ...settings.aiFeatures,
        localModel: {
          ...localModel,
          url,
        },
      },
    });
  };

  const handleAddModel = () => {
    if (!newModelId.trim()) return;
    if (localModel.models.includes(newModelId.trim())) return;

    onSettingsChange({
      ...settings,
      aiFeatures: {
        ...settings.aiFeatures,
        localModel: {
          ...localModel,
          models: [...localModel.models, newModelId.trim()],
        },
      },
    });
    setNewModelId("");
  };

  const handleRemoveModel = (modelId: string) => {
    onSettingsChange({
      ...settings,
      aiFeatures: {
        ...settings.aiFeatures,
        localModel: {
          ...localModel,
          models: localModel.models.filter((m) => m !== modelId),
        },
      },
    });
  };

  return (
    <div className="bg-zinc-900 p-4 px-4 space-y-3 rounded-md transition-all">
      <div className="flex items-center gap-2">
        <Server className="size-5 text-zinc-400" />
        <span>Local Model</span>
      </div>

      <div>
        <p className="text-zinc-400 text-xs ml-1 py-2">
          Host URL (e.g., http://localhost:11434/v1)
        </p>
        <Input
          type="text"
          placeholder="Enter local model host URL..."
          value={localModel.url}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
      </div>

      <div>
        <p className="text-zinc-400 text-xs ml-1 py-2">Model IDs</p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter model ID (e.g., llama3.2)"
            value={newModelId}
            onChange={(e) => setNewModelId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddModel();
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddModel}
            disabled={!newModelId.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {localModel.models.length > 0 && (
          <div className="mt-2 space-y-1">
            {localModel.models.map((modelId) => (
              <div
                key={modelId}
                className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded-md text-sm"
              >
                <span className="font-mono text-zinc-300">{modelId}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => handleRemoveModel(modelId)}
                  className="h-6 w-6 p-0 hover:bg-zinc-700"
                >
                  <Trash2 className="size-3 text-zinc-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AIProviderLogo({
  provider,
  className,
}: {
  provider: AIProvider;
  className?: string;
}) {
  switch (provider) {
    case "Open AI":
      return <OpenAILogo className={className} />;
    case "Anthropic":
      return <AnthropicLogo className={className} />;
    case "Local":
      return <Server className={className} />;
    default:
      return null;
  }
}

function NavCmdButton() {
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <NavCmd open={cmdOpen} onOpenChange={setCmdOpen} />
      <Button onClick={() => setCmdOpen(true)} size="xs">
        <Search /> Search <Kbd cmd="⌘K" />
      </Button>
    </>
  );
}

export function Kbd({ cmd }: { cmd: string }) {
  return (
    <span className="text-xs border-2 border-zinc-800 bg-zinc-950 bg-gradient-to-b from-zinc-700 text-zinc-300 px-1 py-0.5 rounded-sm w-fit">
      {cmd}
    </span>
  );
}

function NavCmd(props: {
  open?: boolean;
  onOpenChange?: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { databases } = useAppData();
  const { connect } = useQueryData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addDatabaseOpen, setAddDatabaseOpen] = useState(false);
  return (
    <>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AddDatabaseDialog open={addDatabaseOpen} setOpen={setAddDatabaseOpen} />
      <CommandDialog
        {...props}
        className="rounded-lg border shadow-md w-[34rem]"
      >
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem
              onSelect={() => {
                setAddDatabaseOpen(true);
                if (props.onOpenChange) {
                  props.onOpenChange(false);
                }
              }}
            >
              <DatabaseIcon />
              <span>Add Connection</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setSettingsOpen(true);
                if (props.onOpenChange) {
                  props.onOpenChange(false);
                }
              }}
            >
              <Settings />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Databases">
            {databases.map((i) => (
              <CommandItem
                key={i.id}
                onSelect={() => {
                  connect(i);
                  if (props.onOpenChange) {
                    props.onOpenChange(false);
                  }
                }}
              >
                <DatabaseIcon />
                Connect to {i.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    </>
  );
}
