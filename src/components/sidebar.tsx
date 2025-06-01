import {
  ArchiveRestore,
  CircleCheck,
  DatabaseBackup,
  Database as DatabaseIcon,
  Loader2,
  Pencil,
  Plug,
  SidebarClose,
  Trash,
  Unplug,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { SetStateAction, useEffect, useRef, useState } from "react";
import ResizableContainer from "./ui/resizableContainer";
import { Database, DatabaseEngine } from "@/types";
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
import { cn } from "@/lib/utils";
import PostgresLogo from "./logos/postgres";
import { useDB } from "@/databaseConnectionProvider";
import Spinner from "./ui/spinner";

export default function Sidebar() {
  const [open, setOpen] = useState(true);

  function handleOpen() {
    setOpen(!open);
  }

  return (
    <ResizableContainer
      direction="horizontal"
      defaultSize={250}
      minSize={60}
      maxSize={500}
      snapThreshold={60}
      isCollapsed={!open}
      onCollapsedChange={(collapsed) => setOpen(!collapsed)}
      className="bg-zinc-900 border border-zinc-800 h-full rounded-r-md"
      collapsedSize={40}
    >
      {open && (
        <div className="w-full flex justify-between items-center p-1.5 border-b border-zinc-800">
          <div className="text-sm flex gap-1.5 items-center">
            <DatabaseIcon className="size-4" /> Databases
          </div>
        </div>
      )}

      <div className="absolute top-0.5 right-1">
        <Button
          onClick={handleOpen}
          size="xs"
          variant="ghost"
          className="w-fit has-[>svg]:px-1"
        >
          <SidebarClose className="text-zinc-500 size-5" />
        </Button>
      </div>

      {open && <DatabaseList />}
    </ResizableContainer>
  );
}

function DatabaseList() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selected, setSelected] = useState<Database | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.db.listDatabases();
        setDatabases(data);
      } catch (err) {
        console.error("Failed to load databases:", err);
      }
    })();
  }, []);

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
    <div ref={listRef}>
      {databases.map((item) => (
        <DatabaseListItem
          key={item.id}
          item={item}
          selected={selected}
          setSelected={setSelected}
        />
      ))}
    </div>
  );
}

function DatabaseListItem({
  item,
  selected,
  setSelected,
}: {
  item: Database;
  selected: Database | null;
  setSelected: React.Dispatch<SetStateAction<Database | null>>;
}) {
  const { connect, connected, loading, disconnect, error, setError } = useDB();

  const [editConnectionOpen, setEditConnectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  function displayLogo(engine: DatabaseEngine) {
    switch (engine) {
      case "Postgres":
        return <PostgresLogo className="size-3" />;
    }
  }

  useEffect(() => {
    if (error !== null && error !== "") {
      setErrorOpen(true);
    }
  }, [error]);

  return (
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
            {" "}
            {error}
          </div>
          <DialogClose asChild>
            <Button onClick={() => setError(null)}>Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <AddDatabaseDialog open={addOpen} setOpen={setAddOpen} />
      <ContextMenu
        onOpenChange={(isOpen) => {
          setSelected(isOpen ? item : null);
        }}
      >
        <ContextMenuTrigger>
          <div
            onClick={() => setSelected(item)}
            className={cn(
              "w-full border-b border-zinc-800 px-2 p-1 transition-all flex gap-1 items-center text-sm",
              selected?.id === item.id && "bg-zinc-800"
            )}
          >
            {loading && <Spinner />}
            {connected.some((i) => i.id === item.id) && (
              <div>
                <CircleCheck className="size-3 text-green-500" />
              </div>
            )}
            {displayLogo(item.engine)}
            {item.name}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="dark bg-zinc-950">
          <ContextMenuItem onClick={() => setAddOpen(true)}>
            <DatabaseIcon /> Add Database
          </ContextMenuItem>
          <ContextMenuItem onClick={() => connect(item)}>
            <Plug /> Connect
          </ContextMenuItem>
          <ContextMenuItem onClick={() => disconnect(item)}>
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
  database: Database;
  open: boolean;
  setOpen: React.Dispatch<SetStateAction<boolean>>;
}) {
  const [loading, setLoading] = useState(false);
  async function handleDelete() {
    setLoading(true);
    await window.db.deleteDatabases([database.id]);
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
          Remove Database{" "}
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
  database: Database;
}) {
  const [details, setDetails] = useState<Database>(database);
  const [loading, setLoading] = useState(false);
  async function handleSave(database: Database) {
    setLoading(true);
    await window.db.updateDatabase(database.id, details);
    setLoading(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dark">
        <DialogTitle>Edit Connection</DialogTitle>
        <DialogDescription>Edit Connection Details</DialogDescription>
        <ConnectionDetailsForm values={details} onChange={setDetails} />
        <div className="flex w-full justify-between">
          <TestConnectionButton database={database} />
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
