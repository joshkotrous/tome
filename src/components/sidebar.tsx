import {
  ArchiveRestore,
  ChevronRight,
  Columns,
  DatabaseBackup,
  Database as DatabaseIcon,
  FileCode,
  Loader2,
  Pencil,
  Plug,
  RefreshCcw,
  SidebarClose,
  Table,
  Trash,
  Unplug,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { SetStateAction, useEffect, useRef, useState } from "react";
import ResizableContainer from "./ui/resizableContainer";
import {
  Connection,
  ConnectionSchema,
  DatabaseEngine,
  IndexJob,
} from "@/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./ui/context-menu";
import {
  AddDatabaseDialog,
  ConnectionDetailsForm,
  TestConnectionButton,
} from "./addDatabaseButton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { cn, parseBool } from "@/lib/utils";
import PostgresLogo from "./logos/postgres";
import Spinner from "./ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Kbd } from "./toolbar";
import { useAppData } from "@/applicationDataProvider";
import { ColumnDef, TableDef } from "core/connections";
import { useQueryData } from "@/queryDataProvider";

export default function Sidebar() {
  const [open, setOpen] = useState(
    parseBool(localStorage.getItem("sidebarOpen"))
  );

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(open));
  }, [open]);

  function handleOpen() {
    setOpen((open) => !open);
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ctrl = e.metaKey
      // cmd = e.ctrlKey
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <ResizableContainer
      direction="horizontal"
      defaultSize={250}
      minSize={60}
      maxSize={500}
      snapThreshold={60}
      isCollapsed={!open}
      onCollapsedChange={(collapsed) => setOpen(!collapsed)}
      className="bg-zinc-900 border border-zinc-800 h-full"
      collapsedSize={40}
    >
      {open && (
        <div className="w-full flex justify-between items-center p-1.5 border-b border-zinc-800 overflow-hidden">
          <div className="text-sm flex gap-1.5 items-center">
            <DatabaseIcon className="size-4" /> Connections
          </div>
        </div>
      )}

      <div className="absolute top-0.5 right-1">
        <Tooltip delayDuration={700}>
          <TooltipTrigger>
            <Button
              onClick={handleOpen}
              size="xs"
              variant="ghost"
              className="w-fit has-[>svg]:px-1"
            >
              <SidebarClose className="text-zinc-500 size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Close Sidebar <Kbd cmd="⌘B" />
          </TooltipContent>
        </Tooltip>
      </div>

      {open && <ConnectionList />}
    </ResizableContainer>
  );
}

function ConnectionList() {
  const [selected, setSelected] = useState<Connection | null>(null);
  const { databases } = useAppData();

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node)) {
        setSelected(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [selected]);

  return (
    <ConnectionListContextMenu>
      <div className="size-full overflow-auto" ref={listRef}>
        {databases.map((item) => (
          <ConnectionListItem
            key={item.id}
            item={item}
            selected={selected}
            setSelected={setSelected}
          />
        ))}
      </div>
    </ConnectionListContextMenu>
  );
}

function ConnectionListItem({
  item,
  selected,
  setSelected,
}: {
  item: Connection;
  selected: Connection | null;
  setSelected: React.Dispatch<SetStateAction<Connection | null>>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ConnectionListContextMenu item={item} setSelected={setSelected}>
        <div className={cn("border-b select-none transition-all")}>
          <div
            onClick={() => setOpen((open) => !open)}
            className={cn(
              "sticky top-0 left-0  z-10 flex bg-zinc-900 justify-between gap-2 items-center hover:bg-zinc-800",
              selected?.id === item.id && "bg-zinc-800"
            )}
          >
            <div
              onClick={() => setSelected(item)}
              className={cn(
                "w-full w-fit border-zinc-800 px-2 p-1 transition-all flex gap-1 items-center text-sm text-nowrap"
              )}
            >
              <DBInformation db={item} />
            </div>
            <ChevronRight
              className={cn("size-5 text-zinc-400", open && "rotate-90")}
            />
          </div>
          {open && <DatabaseList connection={item} />}
        </div>
      </ConnectionListContextMenu>
    </>
  );
}

export function DBInformation({ db }: { db: Connection }) {
  const { connected, loadingDb: loading } = useQueryData();
  const [indexJobs, setIndexJobs] = useState<IndexJob[]>([]);

  function displayLogo(engine: DatabaseEngine) {
    switch (engine) {
      case "Postgres":
        return <PostgresLogo className="size-3" />;
    }
  }

  async function getData() {
    const jobs = await window.jobs.listIndexJobs(db.id, "processing");
    setIndexJobs(jobs);
  }

  useEffect(() => {
    // Initial data fetch
    getData();

    // Set up interval to refresh every 3 seconds
    const interval = setInterval(getData, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [db.id]); // Added db.id as dependency to restart interval if db changes

  return (
    <div className="flex items-center gap-2 pl-1">
      {loading && <Spinner />}
      {connected.some((i) => i.id === db.id) && (
        <div className="aspect-square size-2 bg-green-500 rounded-full blur-[2px]" />
      )}
      {indexJobs.length > 0 && (
        <div>
          <RefreshCcw className="size-3 animate-spin text-zinc-400" />{" "}
        </div>
      )}
      {displayLogo(db.engine)}
      {db.name}
      <span className="text-zinc-400 text-xs pl-1">{db.connection.host}</span>
    </div>
  );
}

function DatabaseList({ connection }: { connection: Connection }) {
  const { connected } = useQueryData();
  const [databases, setDatabases] = useState<string[]>([]);

  const [schema, setSchema] = useState<ConnectionSchema | null>(null);

  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);

  async function getData() {
    const _schema = await window.connections.getConnectionSchema(connection.id);
    setSchema(schema);
    console.log("SCHEMA", JSON.stringify(_schema, null, 2));
    if (connected.some((i) => i.id === connection.id)) {
      setLoading(true);
      const dbs = await window.connections.listRemoteDatabases(connection);
      setDatabases(dbs);
      setLoading(false);
    }
  }

  useEffect(() => {
    getData();
  }, [connected]);

  return (
    <div className={cn("bg-zinc-950/25 py-2 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <DatabaseIcon className="size-3 text-amber-500" /> Databases{" "}
          {loading && <Spinner className="size-3.5" />}
        </div>
      </div>

      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          {databases.map((i) => (
            <DatabaseListItem connection={connection} database={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function DatabaseListItem({
  connection,
  database,
}: {
  connection: Connection;
  database: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <DatabaseIcon className="size-3 text-amber-500" /> {database}{" "}
        </div>
      </div>

      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          <SchemaList connection={connection} database={database} />
        </div>
      )}
    </div>
  );
}

function SchemaList({
  connection,
  database,
}: {
  connection: Connection;
  database: string;
}) {
  const [schemas, setSchemas] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function getData() {
    setLoading(true);
    const _schemas = await window.connections.listSchemas(connection, database);
    setSchemas(_schemas);
    setLoading(false);
  }

  useEffect(() => {
    getData();
  }, []);

  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <FileCode className="size-3 text-blue-500" /> Schemas
          {loading && <Spinner className="size-3.5" />}
        </div>
      </div>

      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          {schemas.map((i) => (
            <SchemaListItem
              connection={connection}
              database={database}
              schema={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaListItem({
  connection,
  database,
  schema,
}: {
  connection: Connection;
  database: string;
  schema: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <FileCode className="size-3 text-blue-500" /> {schema}
        </div>
      </div>
      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          <TableList
            connection={connection}
            database={database}
            schema={schema}
          />
        </div>
      )}
    </div>
  );
}

function TableList({
  schema,
  database,
  connection,
}: {
  connection: Connection;
  database: string;
  schema: string;
}) {
  const [open, setOpen] = useState(false);

  const [tables, setTables] = useState<TableDef[]>([]);
  const [loading, setLoading] = useState(false);

  async function getData() {
    setLoading(true);
    const _tables = await window.connections.listSchemaTables(
      connection,
      schema,
      database
    );
    setLoading(false);
    setTables(_tables);
  }

  useEffect(() => {
    getData();
  }, []);

  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex min-w-fit w-full gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <Table className="size-3 text-purple-500" /> Tables{" "}
          {loading && <Spinner className="size-3.5" />}
        </div>
      </div>

      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          {tables.map((i) => (
            <TableListItem table={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function TableListItem({ table }: { table: TableDef }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex min-w-fit w-full gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <Table className="size-3 text-purple-500" /> {table.table}
        </div>
      </div>

      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          <ColumnList columns={table.columns} />
        </div>
      )}
    </div>
  );
}

function ColumnList({ columns }: { columns: ColumnDef[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => setOpen((open) => !open)}
        className="flex min-w-fit w-full gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <Columns className="size-3 text-zinc-400" /> Columns
        </div>
      </div>

      {open && (
        <div className="space-y-0.5 relative px-12 text-sm">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>

          {columns.map((i) => (
            <div className="flex w-fit gap-1 items-center">
              <Columns className="size-3 text-zinc-400" />
              {i.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionListContextMenu({
  children,
  item,
  setSelected,
}: {
  children: React.ReactNode;
  item?: Connection;
  setSelected?: React.Dispatch<SetStateAction<Connection | null>>;
}) {
  const { connect, disconnect, error, setError, connected } = useQueryData();

  const [editConnectionOpen, setEditConnectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (error !== null && error !== "") {
      setErrorOpen(true);
    }
  }, [error]);

  return (
    <>
      {item && (
        <>
          <EditConnectionForm
            open={editConnectionOpen}
            setOpen={setEditConnectionOpen}
            database={item}
          />
          <DeleteDatabaseDialog
            database={item}
            open={deleteOpen}
            setOpen={setDeleteOpen}
          />
          <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
            <DialogContent className="dark">
              <DialogTitle>Connection Failed</DialogTitle>
              <div className="flex gap-2 items-center font-semibold">
                <X className="text-red-500" /> Failed to connect to {item.name}
              </div>
              <div className="border p-2 rounded-sm font-mono text-xs">
                {error}
              </div>
              <DialogClose asChild>
                <Button onClick={() => setError(null)}>Close</Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </>
      )}

      <AddDatabaseDialog open={addOpen} setOpen={setAddOpen} />
      <ContextMenu
        onOpenChange={(isOpen) => {
          if (setSelected && item) setSelected(isOpen ? item : null);
        }}
      >
        <ContextMenuTrigger>{children}</ContextMenuTrigger>

        <ContextMenuContent className="dark bg-zinc-950">
          <ContextMenuItem onClick={() => setAddOpen(true)}>
            <DatabaseIcon /> Add Connection
          </ContextMenuItem>
          {item && (
            <>
              <ContextMenuItem
                disabled={!connected.some((i) => i.id === item.id)}
                onClick={() => {}}
              >
                <FileCode /> New Query
              </ContextMenuItem>
              <ContextMenuItem
                disabled={connected.some((i) => i.id === item.id)}
                onClick={() => {
                  item && connect(item);
                }}
              >
                <Plug /> Connect
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!connected.some((i) => i.id === item.id)}
                onClick={() => {
                  item && disconnect(item);
                }}
              >
                <Unplug /> Disconnect
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setEditConnectionOpen(true)}>
                <Pencil />
                Edit
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2 text-xs">
                  <Wrench className="text-zinc-500" /> Tools
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem>
                    <DatabaseBackup /> Backup
                  </ContextMenuItem>
                  <ContextMenuItem>
                    <ArchiveRestore /> Restore
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuItem
                onClick={() => setDeleteOpen(true)}
                variant="destructive"
              >
                <Trash /> Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}

function DeleteDatabaseDialog({
  database,
  open,
  setOpen,
}: {
  database: Connection;
  open: boolean;
  setOpen: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { refreshDatabases } = useAppData();
  const [loading, setLoading] = useState(false);
  async function handleDelete() {
    setLoading(true);
    await window.connections.deleteConnections([database.id]);
    refreshDatabases();
    setLoading(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dark">
        <DialogTitle>Remove {database.name}?</DialogTitle>
        <DialogDescription>
          Tome will no longer have access to this database
        </DialogDescription>
        <Button
          disabled={loading}
          onClick={() => handleDelete()}
          variant="destructive"
        >
          Remove Connection{" "}
          {loading && <Loader2 className="size-4 animate-spin" />}
        </Button>
        <DialogClose asChild>
          <Button>Cancel</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function EditConnectionForm({
  open,
  setOpen,
  database,
}: {
  open: boolean;
  setOpen: React.Dispatch<SetStateAction<boolean>>;
  database: Connection;
}) {
  const { refreshDatabases } = useAppData();
  const [details, setDetails] = useState<Connection>(database);
  const [loading, setLoading] = useState(false);
  async function handleSave(database: Connection) {
    setLoading(true);
    await window.connections.updateConnection(database.id, details);
    setLoading(false);
    setOpen(false);
    refreshDatabases();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dark">
        <DialogTitle>Edit Connection</DialogTitle>
        <DialogDescription>Edit Connection Details</DialogDescription>
        <ConnectionDetailsForm values={details} onChange={setDetails} />
        <div className="flex w-full justify-between">
          <TestConnectionButton database={details} />
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button
              disabled={loading}
              onClick={() => handleSave(database)}
              variant="secondary"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
