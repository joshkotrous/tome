import { Check, Database as DatabaseIcon, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { SetStateAction, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Connection,
  ConnectionConfig,
  Database,
  DatabaseEngine,
  DatabaseEngineObject,
} from "@/types";
import PostgresLogo from "./logos/postgres";
import { useAppData } from "@/applicationDataProvider";
import { MySQLLogo } from "./logos/mysql";
import SQLiteLogo from "./logos/sqlite";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

export default function AddDatabaseButton({
  size = "xs",
}: {
  size?: "default" | "xs" | "sm" | "lg" | "icon" | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AddDatabaseDialog open={open} setOpen={setOpen}>
      <div>
        <Button size={size}>
          <DatabaseIcon className="size-4" /> Add Connection
        </Button>
      </div>
    </AddDatabaseDialog>
  );
}

type AddDatabaseStep = "engine" | "connection";

export function AddDatabaseDialog({
  children,
  open,
  setOpen,
}: {
  children?: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div>{children}</div>
      </DialogTrigger>
      <DialogContent className=" max-w-2xl">
        <DialogTitle>Add Connection</DialogTitle>
        <DialogDescription>
          Configure a new database connection
        </DialogDescription>
        <AddConnectionForm
          onComplete={() => setOpen && setOpen((prev) => !prev)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AddConnectionForm({ onComplete }: { onComplete?: () => void }) {
  const { refreshDatabases } = useAppData();
  const [step, setStep] = useState<AddDatabaseStep>("engine");
  const [database, setDatabase] = useState<Omit<Connection, "id">>({
    connection: {
      database: "",
      host: "",
      user: "",
      password: "",
      port: 5432,
      ssl: false,
    },
    description: "",
    engine: "Postgres",
    name: "",
    createdAt: new Date(),
    settings: {
      autoUpdateSemanticIndex: false,
    },
  });

  // Update connection defaults when engine changes
  useEffect(() => {
    setDatabase((prev) => {
      let newConnection: any = {};
      
      switch (prev.engine) {
        case "Postgres":
          newConnection = {
            database: prev.connection.database || "",
            host: prev.connection.host || "localhost",
            user: prev.connection.user || "",
            password: prev.connection.password || "",
            port: prev.connection.port || 5432,
            ssl: prev.connection.ssl || false,
          };
          break;
        case "MySQL":
          newConnection = {
            database: prev.connection.database || "",
            host: prev.connection.host || "localhost",
            user: prev.connection.user || "",
            password: prev.connection.password || "",
            port: prev.connection.port || 3306,
            ssl: prev.connection.ssl || false,
          };
          break;
        case "SQLite":
          // SQLite only needs database (file path)
          newConnection = {
            database: prev.connection.database || "",
            host: "",
            user: "",
            password: "",
            port: 0,
            ssl: false,
          };
          break;
      }
      
      return {
        ...prev,
        connection: newConnection,
      };
    });
  }, [database.engine]);

  const [loading, setLoading] = useState(false);

  function displayStep(step: AddDatabaseStep) {
    switch (step) {
      case "engine":
        return (
          <SelectDatabaseEngine
            engine={database.engine}
            setEngine={(e: DatabaseEngine) =>
              setDatabase((prev) => ({ ...prev, engine: e }))
            }
          />
        );
      case "connection":
        return (
          <ConnectionDetailsForm values={database} onChange={setDatabase} />
        );
    }
  }

  function handleNextStep(step: AddDatabaseStep) {
    switch (step) {
      case "engine":
        setStep("connection");
        break;
    }
  }

  function handlePreviousStep(step: AddDatabaseStep) {
    switch (step) {
      case "engine":
        break;
      case "connection":
        setStep("engine");
        break;
    }
  }

  async function saveDatabase(database: Omit<Connection, "id">) {
    setLoading(true);
    await window.connections.createConnection(database);
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    setLoading(false);
    if (onComplete) {
      onComplete();
    }
    refreshDatabases();
  }

  useEffect(() => {
    if (!open) {
      setStep("engine");
      setDatabase({
        connection: {
          database: "",
          host: "",
          user: "",
          password: "",
          port: 0,
          ssl: false,
        },
        description: "",
        engine: "Postgres",
        name: "",
        createdAt: new Date(),
        settings: {
          autoUpdateSemanticIndex: false,
        },
      });
    }
  }, [open]);

  return (
    <div className="space-y-8">
      {displayStep(step)}
      <div className="flex justify-between">
        {step === "connection" && <TestConnectionButton database={database} />}
        <div className="w-full flex justify-end gap-2">
          <Button
            disabled={step === "engine"}
            onClick={() => handlePreviousStep(step)}
          >
            Back
          </Button>
          {step !== "connection" && (
            <Button onClick={() => handleNextStep(step)} variant="secondary">
              Continue
            </Button>
          )}
          {step === "connection" && (
            <Button
              disabled={
                !database.engine ||
                !database.connection.database ||
                (database.engine !== "SQLite" && (
                  !database.connection.password ||
                  !database.connection.port ||
                  !database.connection.user ||
                  !database.connection.host
                ))
              }
              onClick={() => saveDatabase(database)}
              variant="secondary"
            >
              Save Connection
              {loading && <Loader2 className="size-4 animate-spin" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TestConnectionButton({
  database,
}: {
  database: Omit<Connection, "id">;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    error: string;
  } | null>(null);

  const [open, setOpen] = useState(false);

  async function testConnection(db: Omit<Connection, "id">) {
    setLoading(true);
    try {
      const success = await window.connections.testConnection(db);
      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      setStatus({
        connected: success.success,
        error: success.error,
      });
    } catch (error) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      setStatus({ connected: false, error: String(error) });
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!open) {
      setStatus(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button
          disabled={
            !database.engine ||
            !database.connection.database ||
            (database.engine !== "SQLite" && (
              !database.connection.password ||
              !database.connection.port ||
              !database.connection.user ||
              !database.connection.host
            ))
          }
          onClick={() => testConnection(database)}
          variant="secondary"
        >
          Test Connection
        </Button>
      </DialogTrigger>
      <DialogContent className=" h-96 flex flex-col justify-between">
        <div className="space-y-4">
          <DialogTitle>Test Connection</DialogTitle>
          {status && !status.connected && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <X className="size-6 text-red-500" />
                Connection failed
              </div>
              <div className="text-xs font-mono p-2 border rounded-sm h-56 overflow-auto">
                {status.error}
              </div>
            </div>
          )}
        </div>
        {loading && (
          <div className="size-full flex justify-center items-center">
            <div className="flex gap-2 items-center">
              <Loader2 className="animate-spin size-4" /> Testing connection...
            </div>
          </div>
        )}
        {status && status.connected && (
          <div className="size-full flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Check className="size-5 text-green-500" />
              Connected successfully
            </div>
          </div>
        )}

        <DialogClose asChild>
          <Button>Close</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export function getEngineLogo(engine: DatabaseEngine) {
  switch (engine) {
    case "Postgres":
      return <PostgresLogo className="size-20" />;
    case "MySQL":
      return <MySQLLogo className="size-30" />;
    case "SQLite":
      return <SQLiteLogo className="size-20" />;
  }
}

function SelectDatabaseEngine({
  engine,
  setEngine,
}: {
  engine: DatabaseEngine;
  setEngine: (v: DatabaseEngine) => void;
}) {
  return (
    <div className="space-y-3 w-fit mx-auto">
      <div className="space-y-1">
        <h2 className="font-semibold">Select Database Type</h2>
        <h3 className="text-muted-foreground text-sm">
          Select the database engine type you are connecting to
        </h3>
      </div>

      <div className="w-full grid grid-cols-3 text-center gap-4 items-center justify-center">
        {DatabaseEngineObject.options.map((i) => (
            <Button
              key={i}
              onClick={() => setEngine(i)}
              className={cn(
                `size-48 border rounded-md flex flex-col text-lg`,
                i === engine && "bg-accent"
              )}
            >
              <div className="size-20 flex items-center justify-center">
                {getEngineLogo(i)}
              </div>
              {i}
            </Button>
          ))}
      </div>
    </div>
  );
}

export function ConnectionDetailsForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange:
    | React.Dispatch<SetStateAction<Omit<Connection, "id">>>
    | React.Dispatch<SetStateAction<Connection>>;
}) {
  function getForm() {
    switch (values.engine) {
      case "Postgres":
        return <GeneralConnectionForm values={values} onChange={onChange} />;
      case "MySQL":
        return <MySQLConnectionForm values={values} onChange={onChange} />;
      case "SQLite":
        return <SQLiteConnectionForm values={values} onChange={onChange} />;
    }
  }

  return (
    <div className="w-full space-y-4">
      {getForm()}

      <div className="bg-zinc-800 w-full rounded-md p-4 space-y-1">
        <div className="flex justify-between">
          <h3 className="text-sm font-semibold">
            Automatically Update Semantic Index
          </h3>
          <Switch
            checked={values.settings?.autoUpdateSemanticIndex}
            onCheckedChange={(checked) =>
              onChange((prev: any) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  autoUpdateSemanticIndex: checked,
                },
              }))
            }
          />
        </div>
        <div className="text-xs text-zinc-400">
          Automatically create and update the semantic index for Tome to use as
          context
        </div>
      </div>
    </div>
  );
}

export function GeneralConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange:
    | React.Dispatch<SetStateAction<Omit<Connection, "id">>>
    | React.Dispatch<SetStateAction<Connection>>;
}) {
  const handleTopLevelChange = (
    field: keyof Omit<Database, "connection" | "engine">,
    value: string
  ) => {
    onChange((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConnectionChange = (
    field: keyof ConnectionConfig,
    value: string | number | boolean
  ) => {
    onChange((prev: any) => ({
      ...prev,
      connection: {
        ...prev.connection,
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">General Information</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Top-level name and description */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={values.name}
            placeholder="e.g. Production DB"
            onChange={(e) => handleTopLevelChange("name", e.target.value)}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            value={values.description ?? ""}
            id="description"
            className="h-20 text-sm"
            placeholder="Optional notes or environment context"
            onChange={(e) =>
              handleTopLevelChange("description", e.target.value)
            }
          />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold">Connection Details</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Connection fields */}
        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            value={values.connection.host}
            id="host"
            placeholder="e.g. localhost or db.example.com"
            onChange={(e) => handleConnectionChange("host", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            value={values.connection.port}
            id="port"
            type="number"
            placeholder="e.g. 5432"
            onChange={(e) =>
              handleConnectionChange("port", parseInt(e.target.value))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="database">Database Name</Label>
          <Input
            value={values.connection.database}
            id="database"
            placeholder="e.g. app_prod"
            onChange={(e) => handleConnectionChange("database", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            value={values.connection.user}
            id="username"
            placeholder="e.g. admin"
            onChange={(e) => handleConnectionChange("user", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            value={values.connection.password as string}
            id="password"
            type="password"
            placeholder="••••••••"
            onChange={(e) => handleConnectionChange("password", e.target.value)}
          />
        </div>

        {/* <div className="space-y-1 flex items-center gap-2 col-span-2">
          <Switch
            checked={(values.connection.ssl as boolean) ?? false}
            id="ssl"
            defaultChecked
            onCheckedChange={(v) => handleConnectionChange("ssl", v)}
          />
          <Label htmlFor="ssl">Use SSL</Label>
        </div> */}
      </div>
    </div>
  );
}

export function MySQLConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange:
    | React.Dispatch<SetStateAction<Omit<Connection, "id">>>
    | React.Dispatch<SetStateAction<Connection>>;
}) {
  const handleTopLevelChange = (
    field: keyof Omit<Database, "connection" | "engine">,
    value: string
  ) => {
    onChange((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConnectionChange = (
    field: keyof ConnectionConfig,
    value: string | number | boolean
  ) => {
    onChange((prev: any) => ({
      ...prev,
      connection: {
        ...prev.connection,
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">General Information</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={values.name}
            placeholder="e.g. Production MySQL"
            onChange={(e) => handleTopLevelChange("name", e.target.value)}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            value={values.description ?? ""}
            id="description"
            className="h-20 text-sm"
            placeholder="Optional notes or environment context"
            onChange={(e) =>
              handleTopLevelChange("description", e.target.value)
            }
          />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold">Connection Details</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            value={values.connection.host}
            id="host"
            placeholder="e.g. localhost or mysql.example.com"
            onChange={(e) => handleConnectionChange("host", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            value={values.connection.port}
            id="port"
            type="number"
            placeholder="3306"
            onChange={(e) =>
              handleConnectionChange("port", parseInt(e.target.value))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="database">Database Name</Label>
          <Input
            value={values.connection.database}
            id="database"
            placeholder="e.g. app_prod"
            onChange={(e) => handleConnectionChange("database", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            value={values.connection.user}
            id="username"
            placeholder="e.g. root"
            onChange={(e) => handleConnectionChange("user", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            value={values.connection.password as string}
            id="password"
            type="password"
            placeholder="••••••••"
            onChange={(e) => handleConnectionChange("password", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function SQLiteConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange:
    | React.Dispatch<SetStateAction<Omit<Connection, "id">>>
    | React.Dispatch<SetStateAction<Connection>>;
}) {
  const handleTopLevelChange = (
    field: keyof Omit<Database, "connection" | "engine">,
    value: string
  ) => {
    onChange((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConnectionChange = (
    field: keyof ConnectionConfig,
    value: string | number | boolean
  ) => {
    onChange((prev: any) => ({
      ...prev,
      connection: {
        ...prev.connection,
        [field]: value,
      },
    }));
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.sqlite,.sqlite3';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleConnectionChange("database", file.path);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">General Information</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={values.name}
            placeholder="e.g. Local SQLite Database"
            onChange={(e) => handleTopLevelChange("name", e.target.value)}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            value={values.description ?? ""}
            id="description"
            className="h-20 text-sm"
            placeholder="Optional notes or environment context"
            onChange={(e) =>
              handleTopLevelChange("description", e.target.value)
            }
          />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold">Database File</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="database">Database File Path</Label>
          <div className="flex gap-2">
            <Input
              value={values.connection.database}
              id="database"
              placeholder="e.g. /path/to/database.db"
              onChange={(e) => handleConnectionChange("database", e.target.value)}
            />
            <Button type="button" variant="outline" onClick={handleFileSelect}>
              Browse
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Select an existing SQLite database file or enter a path to create a new one
          </p>
        </div>
      </div>
    </div>
  );
}
