import {
  ArchiveRestore,
  Check,
  ChevronRight,
  Columns,
  DatabaseBackup,
  Database as DatabaseIcon,
  FileCode,
  Loader2,
  Pencil,
  Plug,
  SidebarClose,
  Sparkles,
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
  DatabaseSchema,
  SchemaDef,
  TableSchema,
  Column,
  Schema,
  Table as TableType,
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
import { useQueryData } from "@/queryDataProvider";
import { Textarea } from "./ui/textarea";

// Add a discriminated union for selected entity

type SelectedEntity =
  | { type: "connection"; value: Connection }
  | { type: "schema"; value: Schema }
  | { type: "table"; value: TableType }
  | { type: "column"; value: Column }
  | null;

export default function Sidebar() {
  const [open, setOpen] = useState(
    parseBool(localStorage.getItem("sidebarOpen"))
  );
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

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
      className="bg-zinc-900 border border-zinc-800 h-full flex flex-col"
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
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={handleOpen}
                size="xs"
                variant="ghost"
                className="w-fit has-[>svg]:px-1"
              >
                <SidebarClose className="text-zinc-500 size-5" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Close Sidebar <Kbd cmd="⌘B" />
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {open && <ConnectionList onSelect={setSelectedEntity} />}
      </div>
      {open && <SidebarDetailsPanel selected={selectedEntity} />}
    </ResizableContainer>
  );
}

function ConnectionList({
  onSelect,
}: {
  onSelect: (e: SelectedEntity) => void;
}) {
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
            onSelect={onSelect}
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
  onSelect,
}: {
  item: Connection;
  selected: Connection | null;
  setSelected: React.Dispatch<SetStateAction<Connection | null>>;
  onSelect: (e: SelectedEntity) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ConnectionListContextMenu item={item} setSelected={setSelected}>
        <div className={cn("border-b select-none transition-all")}>
          <div
            onClick={() => setOpen((open) => !open)}
            className={cn(
              "sticky top-0 left-0 z-10 flex min-w-0 bg-zinc-900 justify-between items-center hover:bg-zinc-800",
              selected?.id === item.id && "bg-zinc-800"
            )}
          >
            <div
              onClick={() => {
                setSelected(item);
                onSelect({ type: "connection", value: item });
              }}
              className={cn(
                "min-w-0 flex-1 border-zinc-800 px-2 p-1 transition-all flex gap-1 items-center text-sm"
              )}
            >
              <DBInformation db={item} />
            </div>
            <div className="flex-shrink-0 px-2">
              <ChevronRight
                className={cn(
                  "size-5 text-zinc-400 transition-transform",
                  open && "rotate-90"
                )}
              />
            </div>
          </div>
          {open && <DatabaseList connection={item} onSelect={onSelect} />}
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
        return <PostgresLogo className="size-3 flex-shrink-0" />;
    }
  }

  async function getData() {
    const jobs = await window.jobs.listIndexJobs(db.id, "processing");
    setIndexJobs(jobs);
  }

  useEffect(() => {
    getData();

    const interval = setInterval(getData, 3000);

    return () => clearInterval(interval);
  }, [db.id]);

  return (
    <div className="flex items-center gap-2 pl-1 min-w-0 max-w-full">
      <div className="flex items-center gap-2 flex-shrink-0">
        {loading && <Spinner />}
        {connected.some((i) => i.id === db.id) && (
          <div className="aspect-square size-2 bg-green-500 rounded-full blur-[2px]" />
        )}
        {indexJobs.length > 0 && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div className="relative size-3.5 flex items-center justify-center cursor-help">
                {/* Circular progress ring */}
                <svg
                  className="absolute inset-0 size-3.5"
                  viewBox="0 0 36 36"
                >
                  {/* Background ring */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-zinc-700"
                  />
                  {/* Animated progress ring */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-blue-500"
                    strokeDasharray="94.2"
                    strokeDashoffset="25"
                    style={{
                      transformOrigin: "center",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                </svg>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs p-3">
              <div className="flex flex-col gap-2 min-w-[160px]">
                <span className="font-medium text-zinc-200">Updating Semantic Index</span>
                {(() => {
                  // Aggregate progress from all jobs
                  const totalToProcess = indexJobs.reduce((sum, job) => sum + (job.itemsToProcess || 0), 0);
                  const totalProcessed = indexJobs.reduce((sum, job) => sum + (job.itemsProcessed || 0), 0);
                  const hasProgress = totalToProcess > 0;
                  const progress = hasProgress ? Math.round((totalProcessed / totalToProcess) * 100) : null;
                  
                  return (
                    <div className="flex flex-col gap-1.5">
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        {hasProgress ? (
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        ) : (
                          <div
                            className="h-full bg-blue-500 rounded-full w-1/3"
                            style={{
                              animation: "indeterminate 1.5s ease-in-out infinite",
                            }}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-zinc-400">
                          Indexing databases, schemas, tables...
                        </span>
                        <span className="text-zinc-500">
                          {totalProcessed} / {totalToProcess} items processed
                          {hasProgress && ` (${progress}%)`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {displayLogo(db.engine)}
      </div>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="font-medium truncate max-w-30 flex-shrink-0 ">
          {db.name}
        </span>
        <Tooltip delayDuration={700}>
          <TooltipTrigger className=" truncate min-w-0 text-zinc-400">
            <span className="text-zinc-400 text-xs">{db.connection.host}</span>
          </TooltipTrigger>
          <TooltipContent>{db.connection.host}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function DatabaseList({
  connection,
  onSelect,
}: {
  connection: Connection;
  onSelect: (e: SelectedEntity) => void;
}) {
  const { connected } = useQueryData();
  const [schema, setSchema] = useState<ConnectionSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function getData() {
    setLoading(true);
    const _schema = await window.connections.getConnectionSchema(connection.id);
    setSchema(_schema);
    setLoading(false);
  }

  useEffect(() => {
    getData();
    // eslint-disable-next-line
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
          <DatabaseIcon className="size-3 text-amber-500" /> Databases
          {loading && <Spinner className="size-3.5" />}
        </div>
      </div>
      {open && schema && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          {schema.databases.map((db) => (
            <DatabaseListItem
              key={db.database.id}
              database={db}
              connection={connection}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DatabaseListItem({
  database,
  onSelect,
}: {
  database: DatabaseSchema;
  connection: Connection;
  onSelect: (e: SelectedEntity) => void;
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
          <DatabaseIcon className="size-3 text-amber-500" />{" "}
          {database.database.name}
        </div>
      </div>
      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          <SchemaList schemas={database.schemas} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function SchemaList({
  schemas,
  onSelect,
}: {
  schemas: SchemaDef[];
  onSelect: (e: SelectedEntity) => void;
}) {
  const [open, setOpen] = useState(true); // always open for now
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
        </div>
      </div>
      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          {schemas.map((schema) => (
            <SchemaListItem
              key={schema.schema.id}
              schema={schema}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaListItem({
  schema,
  onSelect,
}: {
  schema: SchemaDef;
  onSelect: (e: SelectedEntity) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => {
          setOpen((open) => !open);
          onSelect({ type: "schema", value: schema.schema });
        }}
        className="flex gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <FileCode className="size-3 text-blue-500" /> {schema.schema.name}
        </div>
      </div>
      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          <TableList tables={schema.tables} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function TableList({
  tables,
  onSelect,
}: {
  tables: TableSchema[];
  onSelect: (e: SelectedEntity) => void;
}) {
  const [open, setOpen] = useState(true); // always open for now
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
          <Table className="size-3 text-purple-500" /> Tables
        </div>
      </div>
      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          {tables.map((table) => (
            <TableListItem
              key={table.table.id}
              table={table}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableListItem({
  table,
  onSelect,
}: {
  table: TableSchema;
  onSelect: (e: SelectedEntity) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("px-4 space-y-0.5")}>
      <div
        onClick={() => {
          setOpen((open) => !open);
          onSelect({ type: "table", value: table.table });
        }}
        className="flex min-w-fit w-full gap-1 items-center hover:bg-zinc-800 transition-all px-4.5"
      >
        <ChevronRight
          className={cn(
            "size-4 text-zinc-400",
            open && "rotate-90 transition-all"
          )}
        />
        <div className="text-sm flex gap-1 items-center">
          <Table className="size-3 text-purple-500" /> {table.table.name}
        </div>
      </div>
      {open && (
        <div className="space-y-0.5 relative">
          <div className="w-0.5 h-full bg-zinc-700/50 absolute left-6"></div>
          <ColumnList columns={table.columns} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function ColumnList({
  columns,
  onSelect,
}: {
  columns: Column[];
  onSelect: (e: SelectedEntity) => void;
}) {
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
            <div
              key={i.id}
              className="flex w-fit gap-1 items-center cursor-pointer"
              onClick={() => onSelect({ type: "column", value: i })}
            >
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
  const { connect, disconnect, connectError, setConnectError, connected } =
    useQueryData();

  const [editConnectionOpen, setEditConnectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (connectError !== null && connectError !== "") {
      setErrorOpen(true);
    }
  }, [connectError]);

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
            <DialogContent className="">
              <DialogTitle>Connection Failed</DialogTitle>
              <div className="flex gap-2 items-center font-semibold">
                <X className="text-red-500" /> Failed to connect to {item.name}
              </div>
              <div className="border p-2 rounded-sm font-mono text-xs">
                {connectError}
              </div>
              <DialogClose asChild>
                <Button onClick={() => setConnectError(null)}>Close</Button>
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
                  <ContextMenuItem
                    onClick={() => {
                      window.jobs.updateSemanticIndex(item);
                    }}
                  >
                    <Sparkles /> Update Semantic Index
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
      <DialogContent className="">
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
      <DialogContent className="">
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

function SidebarDetailsPanel({ selected }: { selected: SelectedEntity }) {
  const [open, setOpen] = useState(false);

  if (!selected) {
    return (
      <div
        className="border-t border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400 select-none cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight
          className={cn("inline size-3 mr-1", open && "rotate-90")}
        />
        Details
      </div>
    );
  }
  return (
    <div className="border-t border-zinc-800 bg-zinc-950/50">
      <div
        className="p-2 text-xs text-zinc-400 select-none cursor-pointer flex items-center gap-1"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight className={cn("inline size-3", open && "rotate-90")} />
        Details
      </div>
      {open && (
        <div className="text-xs text-zinc-200">
          {selected.type === "connection" && (
            <>
              <div className="border-b border-t p-1.5 font-mono">
                Entity: Connection
              </div>
              <div className="p-1.5 border-b font-mono">
                Name: {selected.value.name}
              </div>
              <EntityDescription entity={selected} />
            </>
          )}
          {selected.type === "schema" && (
            <>
              <div className="border-b border-t p-1.5 font-mono">
                Entity: Schema
              </div>
              <div className="p-1.5 border-b font-mono">
                Name: {selected.value.name}
              </div>
              <EntityDescription entity={selected} />
            </>
          )}
          {selected.type === "table" && (
            <>
              <div className="border-b border-t p-1.5 font-mono">
                Entity: Table
              </div>
              <div className="p-1.5 border-b font-mono">
                Name: {selected.value.name}
              </div>

              <EntityDescription entity={selected} />
            </>
          )}
          {selected.type === "column" && (
            <>
              <div className="border-b border-t p-1.5 font-mono">
                Entity: Column
              </div>
              <div className="p-1.5 border-b font-mono">
                Name: {selected.value.name}
              </div>
              <div className="flex items-center gap-2 border-b font-mono p-1.5">
                Type: {selected.value.type}
              </div>
              <EntityDescription entity={selected} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EntityDescription({ entity }: { entity: SelectedEntity }) {
  const [input, setInput] = useState<string>(entity?.value.description ?? "");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setInput(entity?.value?.description ?? "");
  }, [entity]);

  if (!entity) {
    return null;
  }

  async function handleUpdate() {
    if (!entity) {
      return;
    }
    switch (entity.type) {
      case "connection":
        await window.connections.updateConnection(entity?.value.id, {
          description: input,
        });
        break;
      case "column":
        await window.columns.updateColumn(entity.value.id, {
          description: input,
        });
        break;
      case "table":
        await window.tables.updateTable(entity.value.id, {
          description: input,
        });
        break;
      case "schema":
        await window.schemas.updateSchema(entity.value.id, {
          description: input,
        });
        break;
    }
    if (entity.value) {
      entity.value.description = input;
    }
  }

  return (
    <div className="p-1.5 px-2 text-zinc-300 h-48 relative flex flex-col">
      <div className="flex justify-end gap-1 items-center mb-2 flex-shrink-0">
        <Button
          onClick={async () => {
            if (editMode) {
              await handleUpdate();
            }
            setEditMode((prev) => !prev);
          }}
          variant="ghost"
          className="!p-1 !h-fit !text-xs bg-zinc-950 hover:text-green-500"
        >
          {editMode ? (
            <Check className="size-3" />
          ) : (
            <Pencil className="size-3" />
          )}
        </Button>
        {editMode && (
          <Button
            onClick={() => {
              setEditMode((prev) => !prev);
              setInput(entity?.value.description ?? "");
            }}
            variant="ghost"
            className="!p-1 !h-fit !text-xs hover:text-red-600"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {editMode ? (
          <Textarea
            className="!bg-transparent border-none !text-xs !p-1 !rounded-sm w-full h-full resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        ) : (
          <div className="overflow-y-auto h-full text-xs leading-relaxed">
            {input}
          </div>
        )}
      </div>
    </div>
  );
}
