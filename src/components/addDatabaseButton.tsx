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
import { Switch } from "./ui/switch";
import {
  Connection,
  Database,
  DatabaseEngine,
  DatabaseEngineObject,
} from "@/types";
import PostgresLogo from "./logos/postgres";

export default function AddDatabaseButton() {
  return (
    <AddDatabaseDialog>
      <Button size="xs">
        <DatabaseIcon className="size-4" /> Add Database
      </Button>
    </AddDatabaseDialog>
  );
}

type AddDatabaseStep = "engine" | "connection";

function AddDatabaseDialog({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<AddDatabaseStep>("engine");
  const [database, setDatabase] = useState<Omit<Database, "id">>({
    connection: {
      database: "",
      host: "",
      username: "",
      password: "",
      port: 5432,
      ssl: true,
    },
    description: "",
    engine: "Postgres",
    name: "",
  });

  const [open, setOpen] = useState(false);

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
        return <ConnectionDetailsForm onChange={setDatabase} />;
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

  async function saveDatabase(database: Omit<Database, "id">) {
    setLoading(true);
    await window.db.createDatabase(database);
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    setLoading(false);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      setStep("engine");
      setDatabase({
        connection: {
          database: "",
          host: "",
          username: "",
          password: "",
          port: 0,
          ssl: true,
        },
        description: "",
        engine: "Postgres",
        name: "",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="dark max-w-2xl">
        <DialogTitle>Add Database</DialogTitle>
        <DialogDescription>
          Configure a new database connection
        </DialogDescription>
        {displayStep(step)}
        <div className="flex justify-between">
          {step === "connection" && (
            <TestConnectionButton database={database} />
          )}
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
                  !database.connection.password ||
                  !database.connection.port ||
                  !database.connection.username ||
                  !database.connection.host
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
      </DialogContent>
    </Dialog>
  );
}

function TestConnectionButton({
  database,
}: {
  database: Omit<Database, "id">;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    error: string;
  } | null>(null);

  const [open, setOpen] = useState(false);

  async function testConnection(db: Omit<Database, "id">) {
    setLoading(true);
    try {
      const success = await window.db.testConnection(db);
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
            !database.connection.password ||
            !database.connection.port ||
            !database.connection.username ||
            !database.connection.host
          }
          onClick={() => testConnection(database)}
          variant="secondary"
        >
          Test Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="dark h-96 flex flex-col justify-between">
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

function SelectDatabaseEngine({
  engine,
  setEngine,
}: {
  engine: DatabaseEngine;
  setEngine: (v: DatabaseEngine) => void;
}) {
  function getEngineLogo(engine: DatabaseEngine) {
    switch (engine) {
      case "Postgres":
        return <PostgresLogo className="size-20" />;
        break;
    }
  }

  return (
    <div className="space-y-3 w-full">
      <div className="space-y-1">
        <h2 className="font-semibold">Select Database Type</h2>
        <h3 className="text-muted-foreground text-sm">
          Select the database engine type you are connecting to
        </h3>
      </div>

      <div className="w-full grid grid-cols-3 text-center gap-2 items-center justify-center">
        {DatabaseEngineObject.options.map((i) => (
          <Button
            onClick={() => setEngine(i)}
            className={cn(
              `size-48 border rounded-md flex flex-col text-lg`,
              i === engine && "bg-accent"
            )}
          >
            {getEngineLogo(i)} {i}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ConnectionDetailsForm({
  onChange,
}: {
  onChange: React.Dispatch<SetStateAction<Omit<Database, "id">>>;
}) {
  const handleTopLevelChange = (
    field: keyof Omit<Database, "connection" | "engine">,
    value: string
  ) => {
    onChange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConnectionChange = (
    field: keyof Connection,
    value: string | number | boolean
  ) => {
    onChange((prev) => ({
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
            placeholder="e.g. Production DB"
            onChange={(e) => handleTopLevelChange("name", e.target.value)}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
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
            id="host"
            placeholder="e.g. localhost or db.example.com"
            onChange={(e) => handleConnectionChange("host", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
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
            id="database"
            placeholder="e.g. app_prod"
            onChange={(e) => handleConnectionChange("database", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="e.g. admin"
            onChange={(e) => handleConnectionChange("username", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            onChange={(e) => handleConnectionChange("password", e.target.value)}
          />
        </div>

        <div className="space-y-1 flex items-center gap-2 col-span-2">
          <Switch
            id="ssl"
            defaultChecked
            onCheckedChange={(v) => handleConnectionChange("ssl", v)}
          />
          <Label htmlFor="ssl">Use SSL</Label>
        </div>
      </div>
    </div>
  );
}
