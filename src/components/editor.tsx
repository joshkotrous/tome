import {
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";

import * as monacoEditor from "monaco-editor";
import { FileCode, Play, PlayCircle, Plus, RefreshCcw, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
// import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
// import { Textarea } from "./ui/textarea";
import { Kbd, NewQueryButton } from "./toolbar";
import { useQueryData } from "@/queryDataProvider";
import { useAppData } from "@/applicationDataProvider";
import AddDatabaseButton from "./addDatabaseButton";
import { cn, parseBool } from "@/lib/utils";
import ChatInterface, { ChatInputDisplay } from "./chatInterface";
import { Switch } from "./ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { TomeAgentModel } from "../../core/ai";
import ResizableContainer from "./ui/resizableContainer";
import { ConnectionSchema, Query } from "@/types";
import { DBInformation } from "./sidebar";
import { createSchemaCompletionProvider } from "./monacoConfig";
import { useAgent } from "@/agent/useAgent";

export default function QueryInterface() {
  const { agentModeEnabled, setAgentModeEnabled, settings } = useAppData();

  useEffect(() => {}, [settings]);

  return (
    <div className="flex-1 min-h-0 size-full bg-zinc-950 rounded-t-md flex flex-col">
      <div className="border-b p-2 flex justify-end items-center flex-shrink-0">
        {settings?.aiFeatures.enabled && (
          <div className="text-xs flex items-center gap-2">
            <Switch
              checked={agentModeEnabled}
              onCheckedChange={setAgentModeEnabled}
            />
            Agent Mode
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {agentModeEnabled ? (
            <motion.div
              key="chat-interface"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              <ChatInterface />
            </motion.div>
          ) : (
            <motion.div
              key="sql-editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              <SqlEditor />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function SqlEditor() {
  const { queries, currentQuery, runQuery, updateQuery, currentConnection } =
    useQueryData();
  const [schema, setSchema] = useState<ConnectionSchema | null>(null);
  const [queryContent, setQueryContent] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [hasSelection, setHasSelection] = useState(false);
  const { databases } = useAppData();
  const [thinking, setThinking] = useState(false);
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(
    null
  );

  // Simplified handleChange function
  const handleChange = useCallback(
    (value?: string) => {
      if (currentQuery && value !== undefined) {
        const updatedQuery = {
          ...currentQuery,
          query: value,
        };
        updateQuery(updatedQuery);
      }
    },
    [currentQuery, updateQuery]
  );

  useEffect(() => {
    if (currentQuery) {
      setQueryContent(currentQuery?.query);
    }
  }, [currentQuery]);

  async function getData() {
    if (currentConnection) {
      const _schema = await window.connections.getConnectionSchema(
        currentConnection.id
      );
      setSchema(_schema);
    }
  }

  // Handle container resize to update Monaco layout
  useEffect(() => {
    getData();
    const handleResize = () => {
      if (editorRef.current) {
        // Small delay to ensure DOM has updated
        requestAnimationFrame(() => {
          editorRef.current?.layout();
        });
      }
    };
    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    const editorContainer = document.querySelector(".monaco-editor");
    if (editorContainer) {
      resizeObserver.observe(editorContainer.parentElement || editorContainer);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [getData]);

  useEffect(() => {
    handleChange(queryContent);
  }, [queryContent]);

  // Track selection changes
  const handleSelectionChange = useCallback(() => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText =
          editorRef.current.getModel()?.getValueInRange(selection) || "";
        setSelectedText(selectedText.trim());
        setHasSelection(selectedText.trim().length > 0);
      } else {
        setSelectedText("");
        setHasSelection(false);
      }
    }
  }, []);

  const handleMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;

    // Listen for selection changes
    editor.onDidChangeCursorSelection(handleSelectionChange);

    monaco.editor.defineTheme("zinc-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#09090b",
        "editorGutter.background": "#09090b",
        "editorLineNumber.foreground": "#4b5563",
        "editorLineNumber.activeForeground": "#f4f4f5",
      },
    });
    monaco.editor.setTheme("zinc-dark");

    if (!currentConnection) return;

    const _schema = await window.connections.getFullSchema(currentConnection);

    // Command to run full query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      handleRunQuery()
    );

    // Command to run selection (Ctrl/Cmd + Shift + Enter)
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => handleRunSelection()
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () =>
      editor.trigger("keyboard", "editor.action.triggerSuggest", undefined)
    );

    const disposable = monaco.languages.registerCompletionItemProvider(
      "sql",
      createSchemaCompletionProvider(_schema, currentConnection)
    );

    monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", "."],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range: monacoEditor.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const suggestions: monacoEditor.languages.CompletionItem[] = [
          {
            label: "select",
            kind: monacoEditor.languages.CompletionItemKind.Keyword,
            insertText: "SELECT ",
            range,
          },
          {
            label: "from",
            kind: monacoEditor.languages.CompletionItemKind.Keyword,
            insertText: "FROM ",
            range,
          },
        ];
        return { suggestions };
      },
    });

    return disposable;
  };

  if (databases.length === 0) {
    return (
      <div className="size-full flex flex-1 justify-center items-center flex-col gap-2 text-zinc-400">
        Create a connection to get started
        <AddDatabaseButton size="default" />
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="flex flex-1 size-full justify-center items-center flex-col gap-2 text-zinc-400">
        Create a query to get started
        <NewQueryButton size="default" />
      </div>
    );
  }

  async function handleRunQuery() {
    if (currentQuery && currentConnection) {
      await runQuery(currentConnection, queryContent);
    }
  }

  async function handleRunSelection() {
    if (currentQuery && currentConnection && hasSelection && selectedText) {
      await runQuery(currentConnection, selectedText);
    }
  }

  async function handleClearQuery() {
    if (currentQuery) {
      const clearedQuery = { ...currentQuery, query: "" };
      updateQuery(clearedQuery);
    }
  }

  return (
    <div className="size-full flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <QueryTabs />
        <div className="w-full border-b border-zinc-800 p-2 font-mono text-xs text-zinc-500 flex items-center gap-2">
          {currentConnection && <DBInformation db={currentConnection} />}
          <div className="flex items-center gap-0.5">
            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <Button
                  onClick={() => handleRunQuery()}
                  variant="ghost"
                  className="has-[>svg]:p-1.5 h-fit"
                >
                  <Play className="size-3.5 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Run query <Kbd cmd="⌘↵" />
              </TooltipContent>
            </Tooltip>

            {/* Run Selection Button - only show when text is selected */}

            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <Button
                  disabled={!hasSelection}
                  onClick={() => handleRunSelection()}
                  variant="ghost"
                  className="has-[>svg]:p-1.5 h-fit"
                >
                  <PlayCircle className="size-3.5 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Run selection <Kbd cmd="⌘⇧↵" />
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <Button
                  onClick={() => handleClearQuery()}
                  variant="ghost"
                  className="has-[>svg]:p-1.5 h-fit"
                >
                  <RefreshCcw className="size-3.5 text-amber-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Clear query <Kbd cmd="⌘C" />
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0">
          {currentConnection && (
            <MonacoEditor
              height="100%"
              defaultLanguage="sql"
              theme="zinc-dark"
              value={queryContent}
              onChange={(e) => setQueryContent(e ?? "")}
              onMount={handleMount}
              options={{
                minimap: { enabled: false },
                wordWrap: "on",
                fontSize: 14,
                tabSize: 2,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                mouseWheelZoom: false,
                contextmenu: false,
              }}
              className="bg-zinc-950"
            />
          )}
        </div>
      </div>
      <EditorAgent
        schema={schema}
        query={queryContent}
        onQueryChange={setQueryContent}
        thinking={thinking}
        setThinking={setThinking}
      />
    </div>
  );
}

function EditorAgent({
  schema,
  query,
  onQueryChange,
  thinking,
  setThinking,
}: {
  schema: ConnectionSchema | null;
  query: string;
  onQueryChange: React.Dispatch<SetStateAction<string>>;
  thinking: boolean;
  setThinking: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { currentQuery, queryMessages, currentConnection } = useQueryData();
  const [collapsed, setCollapsed] = useState(
    parseBool(localStorage.getItem("editorAgentOpen"))
  );
  const [input, setInput] = useState("");
  const [model, setModel] = useState<TomeAgentModel>({
    provider: "Open AI",
    name: "gpt-4o",
  });

  // Use the new agent hook
  const {
    messages,
    sendMessage,
    thinking: agentThinking,
    approveQuery,
    permissionNeeded,
    setPermissionNeeded,
  } = useAgent({
    initialMessages: queryMessages,
    mode: "editor",
    model,
    schema: schema || { connection: currentConnection!, databases: [] },
    query,
    setQuery: onQueryChange,
  });

  // Sync thinking state
  useEffect(() => {
    setThinking(agentThinking);
  }, [agentThinking, setThinking]);

  useEffect(() => {
    localStorage.setItem("editorAgentOpen", String(collapsed));
  }, [collapsed]);

  async function handleSendMessage(input: string) {
    setInput("");
    setPermissionNeeded(false);
    if (!currentQuery) return;
    await sendMessage(input);
  }

  return (
    <ResizableContainer
      isCollapsed={collapsed}
      onCollapsedChange={setCollapsed}
      defaultSize={400}
      minSize={40}
      maxSize={800}
      snapThreshold={60}
      side="left"
      className="h-full border-l bg-zinc-900/50"
    >
      {collapsed && (
        <Button
          onClick={() => setCollapsed((prev) => !prev)}
          variant="ghost"
          className="has-[>svg]:px-1.5 left-1 top-1 h-fit py-1 relative text-zinc-400"
        >
          <FileCode className="size-4 " />
        </Button>
      )}
      {!collapsed && (
        <div className="size-full pb-7">
          <div className="flex p-0.5 gap-1.5 items-center text-zinc-400 text-xs border-b text-nowrap w-full min-w-fit">
            <Button
              onClick={() => setCollapsed((prev) => !prev)}
              variant="ghost"
              className="has-[>svg]:p-1.5 h-fit left-1 relative"
            >
              <FileCode className="size-4 " />
            </Button>
            Editor Agent
          </div>

          <ChatInputDisplay
            refreshResponse={approveQuery}
            permissionNeeded={permissionNeeded}
            showQueryControls
            thinking={thinking}
            messages={messages}
            input={input}
            model={model}
            setInput={setInput}
            setModel={setModel}
            sendMessage={handleSendMessage}
          />
        </div>
      )}
    </ResizableContainer>
  );
}

interface QueryTabProps {
  query: Query;
  isSelected: boolean;
  onSelect: (query: Query) => void;
  onDelete: (query: Query) => void;
  onUpdate: (query: Query) => void;
}

function QueryTab({
  query,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
}: QueryTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(query.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Reset editing title when query title changes
  useEffect(() => {
    setEditingTitle(query.title);
  }, [query.title]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditingTitle(query.title);
  };

  const handleSaveEdit = () => {
    if (editingTitle.trim() && editingTitle !== query.title) {
      onUpdate({
        ...query,
        title: editingTitle.trim(),
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTitle(query.title);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleClick = () => {
    if (!isEditing) {
      onSelect(query);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) {
      handleCancelEdit();
    } else {
      onDelete(query);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "min-w-30 p-1 h-8 text-[0.7rem] border w-fit pl-3 pr-2 flex gap-2 justify-between items-center font-mono transition-all cursor-pointer rounded-md",
        isSelected && "bg-zinc-800/75",
        isEditing && "cursor-text"
      )}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent outline-none border-none text-[0.7rem] font-mono min-w-0 flex-1"
          style={{ width: `${Math.max(editingTitle.length * 0.6, 4)}ch` }}
        />
      ) : (
        <span className="truncate">{query.title}</span>
      )}

      <Tooltip delayDuration={700}>
        <TooltipTrigger>
          <X
            onClick={handleDeleteClick}
            className="size-3 hover:text-red-500 transition-all flex-shrink-0"
          />
        </TooltipTrigger>
        <TooltipContent>
          {isEditing ? "Cancel edit" : "Close file"} <Kbd cmd="⌘W" />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function QueryTabs() {
  const {
    queries,
    deleteQuery,
    setCurrentQuery,
    currentQuery,
    updateQuery,
    createQuery,
    currentConnection,
  } = useQueryData();

  return (
    <div className="border-b flex overflow-x-auto min-h-8 items-center p-2 gap-2">
      {queries.map((query) => (
        <QueryTab
          key={query.id}
          query={query}
          isSelected={currentQuery?.id === query.id}
          onSelect={setCurrentQuery}
          onDelete={deleteQuery}
          onUpdate={updateQuery}
        />
      ))}
      <Tooltip delayDuration={700}>
        <TooltipTrigger>
          <Button
            onClick={() => {
              if (!currentConnection) return;
              createQuery({
                connection: currentConnection?.id,
                createdAt: new Date(),
                query: "",
                title: "untitled",
              });
            }}
            size="xs"
            className="h-fit !p-1 ml-2 sticky right-1"
          >
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New query</TooltipContent>
      </Tooltip>
    </div>
  );
}
// export function GenerateQueryPopover({
//   setIsGenerating,
//   isGenerating,
//   children,
//   value,
//   onChange,
// }: {
//   setIsGenerating: React.Dispatch<SetStateAction<boolean>>;
//   isGenerating: boolean;
//   children: React.ReactNode;
//   value: string;
//   onChange: (val: string) => void;
// }) {
//   const { currentQuery, currentConnection } = useQueryData();

//   const [schema, setSchema] = useState<DatabaseSchema | null>(null);

//   const { settings } = useAppData();
//   const [input, setInput] = useState("");
//   const [open, setOpen] = useState(false);

//   const [loadingSchema, setLoadingSchema] = useState(false);

//   async function submit() {
//     setOpen(false);
//     if (
//       !settings?.aiFeatures.enabled ||
//       (!settings.aiFeatures.providers.openai.enabled &&
//         !settings.aiFeatures.providers.anthropic.enabled)
//     )
//       return;

//     setIsGenerating(true);

//     try {
//       const streamResult = streamResponse({
//         apiKey: settings.aiFeatures.apiKey,
//         provider: settings.aiFeatures.provider,
//         model: "gpt-4o",
//         prompt: `${value}\n${input}`,
//         system: `You are a SQL query generator. Generate a SQL query based on the user's request. Only return the SQL query without any additional text or formatting. Do not include backticks or \`\`\`sql tags, you're working directly in an editor. \n GUIDELINES: 1. Remember when using postgres and you encounter a column in camel case, it MUST be surrounded by double quotes.\n2. Do NOT include placeholder values, all queries must be valid  \n See below for the full database schema and connection information:\nEngine:\n${
//           currentConnection?.engine
//         }\n${JSON.stringify(schema, null, 2)}`,
//       });

//       // Start with empty content and build it up
//       let generatedContent = "";

//       for await (const textPart of streamResult.textStream) {
//         generatedContent += textPart;
//         // Update the current query with the accumulated content
//         onChange(generatedContent);
//       }

//       // Reset input after successful generation
//       setInput("");
//     } catch (error) {
//       console.error("Error generating query:", error);
//     } finally {
//       setIsGenerating(false);
//     }
//   }

//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
//       e.preventDefault();
//       submit();
//     }
//   };

//   async function getFullSchema() {
//     setLoadingSchema(true);
//     if (!currentQuery) return;
//     const connection = await window.db.getDatabase(currentQuery.connection);
//     const _schema = await window.db.getFullSchema(connection);
//     setSchema(_schema);
//     setLoadingSchema(false);
//   }

//   useEffect(() => {
//     getFullSchema();
//   }, [currentQuery]);

//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger>{children}</PopoverTrigger>
//       <PopoverContent className="dark text-sm space-y-2">
//         <h2 className="font-bold">Generate Query</h2>
//         <Textarea
//           disabled={loadingSchema}
//           value={input}
//           onChange={(e) => setInput(e.target.value)}
//           onKeyDown={handleKeyDown}
//           placeholder={
//             loadingSchema
//               ? "Loading schema..."
//               : "What would you like to query?"
//           }
//           autoFocus
//         />
//         <Button
//           className="w-full"
//           size="xs"
//           variant="secondary"
//           onClick={submit}
//           disabled={isGenerating || !input.trim()}
//         >
//           {isGenerating ? "Generating..." : "Generate Query"}
//         </Button>
//       </PopoverContent>
//     </Popover>
//   );
// }
