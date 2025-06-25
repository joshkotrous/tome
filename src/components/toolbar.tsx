import {
  DatabaseIcon,
  FileCode,
  Loader2,
  LucideProps,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
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
    useState<"AI Features">("AI Features");

  const pageOptions: {
    title: "AI Features";
    icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref">>;
  }[] = [
    {
      title: "AI Features",
      icon: Sparkles,
    },
  ];

  function displayPage(page: "AI Features") {
    switch (page) {
      case "AI Features":
        return <AIFeaturesSettingsPage />;
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
            {/* <ConfigureProvider
              provider="Anthropic"
              settings={settings}
              onSettingsChange={setSettings}
            /> */}
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
