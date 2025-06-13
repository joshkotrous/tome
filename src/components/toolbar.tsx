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
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import React, { SetStateAction, useEffect, useState } from "react";
import { Database, Settings as SettingsType } from "@/types";
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
import { useDB } from "@/databaseConnectionProvider";
import { useQueryData } from "@/queryDataProvider";
import { nanoid } from "nanoid";
import TomeLogo from "./logos/tome";
export default function Toolbar() {
  const { agentModeEnabled } = useAppData();
  return (
    <div className="w-full h-14 grid grid-cols-[4rem_1fr_1fr_1fr] gap-3 items-center border-b border-zinc-800 pr-3">
      <div id="mac-stoplight" className="w-10 h-full"></div>
      <div className="flex gap-2">
        <AddDatabaseButton />
        {!agentModeEnabled && <NewQueryButton />}
      </div>
      {/* <div className="text-center text-xs text-zinc-400 font-mono">
        tome 0.0.0
      </div> */}
      <div className="flex justify-center">
        <TomeLogo className="size-14" />
      </div>

      <div className="flex gap-2 justify-end">
        <NavCmdButton />
        <SettingsDialog>
          <Button size="xs">
            <Settings className="size-4" />
          </Button>
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
  const { connected } = useDB();
  const { createQuery } = useQueryData();

  const [selectConnectionOpen, setSelectConnectionOpen] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);
  function handleNewQuery() {
    if (connected.length === 0) {
      setSelectConnectionOpen(true);
    }

    if (connected.length === 1) {
      const newQuery = { id: nanoid(4), connection: connected[0], query: "" };
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
  setSelected?: React.Dispatch<SetStateAction<Database | null>>;
  open: boolean;
  onOpenChange: React.Dispatch<SetStateAction<boolean>>;
  children?: React.ReactNode;
}) {
  const { databases } = useAppData();
  const { connected } = useDB();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="dark max-w-2xl">
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
  connections: Database[];
  setSelected?: React.Dispatch<SetStateAction<Database | null>>;
  onOpenChange: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { connect } = useDB();

  const { createQuery, setCurrrentQuery } = useQueryData();

  return (
    <div className="border rounded-md overflow-hidden">
      {connections.map((i) => (
        <div
          className="hover:bg-zinc-800 transition-all p-2"
          onClick={() => {
            if (setSelected) {
              setSelected(i);
            }
            onOpenChange(false);
            connect(i);
            const newQuery = { id: nanoid(4), connection: i, query: "" };

            createQuery(newQuery);
            setCurrrentQuery(newQuery);
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
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="dark max-w-2xl">
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Manage your workspace settings</DialogDescription>
        <div className="flex size-full gap-4">
          <div className="h-full  flex flex-col w-36 items-end border-r pr-2 gap-2">
            {pageOptions.map((i) => (
              <Button
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
  const [settings, setSettings] = useState<SettingsType>({
    setupComplete: false,
    aiFeatures: {
      provider: "Open AI",
      enabled: false,
    },
  });
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

  return (
    <div className="pt-1 space-y-4 size-full">
      <h2 className="font-semibold text-xl">AI Features</h2>
      <div className="space-y-3">
        <div className="flex gap-4 2items-center text-sm text-zinc-400 items-center">
          Enabled{" "}
          <Switch
            checked={settings?.aiFeatures.enabled}
            onCheckedChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                aiFeatures: {
                  ...prev.aiFeatures,
                  enabled: e,
                },
              }))
            }
          />
        </div>
        <div className="flex gap-2  text-sm text-zinc-400 flex-col">
          Provider{" "}
          <Select
            disabled={!settings.aiFeatures.enabled}
            onValueChange={(val: "Open AI" | "Anthropic") =>
              setSettings((prev) => ({
                ...prev,
                aiFeatures: { enabled: prev.aiFeatures.enabled, provider: val },
              }))
            }
          >
            <SelectTrigger>
              {settings.aiFeatures.provider ?? "Open AI"}
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value="Open AI">Open AI</SelectItem>
              <SelectItem value="Anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 2items-center text-sm text-zinc-400  flex-col">
          API Key{" "}
          <Input
            disabled={!settings.aiFeatures.enabled}
            value={settings.aiFeatures.apiKey}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                aiFeatures: {
                  enabled: prev.aiFeatures.enabled,
                  provider: prev.aiFeatures.provider,
                  apiKey: e.target.value,
                },
              }))
            }
            type="password"
          />
        </div>
        <Button
          disabled={
            updating || (initialSettings ? initialSettings === settings : true)
          }
          onClick={async () => await saveSettings(settings)}
          variant="secondary"
          className="w-full"
        >
          Save {updating && <Loader2 className="size-3 animate-spin" />}
        </Button>
      </div>
    </div>
  );
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
  const { connect } = useDB();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addDatabaseOpen, setAddDatabaseOpen] = useState(false);
  return (
    <>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AddDatabaseDialog open={addDatabaseOpen} setOpen={setAddDatabaseOpen} />
      <CommandDialog
        {...props}
        className="rounded-lg border shadow-md w-[34rem] dark"
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
