import {
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";

import * as monacoEditor from "monaco-editor";
import { FileCode, Play, RefreshCcw, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Textarea } from "./ui/textarea";
import { Kbd, NewQueryButton } from "./toolbar";
import { useQueryData } from "@/queryDataProvider";
import { useAppData } from "@/applicationDataProvider";
import AddDatabaseButton from "./addDatabaseButton";
import { cn, parseBool } from "@/lib/utils";
import ChatInterface, { ChatInputDisplay, Thinking } from "./chatInterface";
import { Switch } from "./ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { streamResponse, TomeAgentModel, ToolMap } from "../../core/ai";
import { DatabaseSchema } from "core/database";
import ResizableContainer from "./ui/resizableContainer";
import { ConversationMessage, Query } from "@/types";
import { z } from "zod";
import { tool } from "ai";
import { useDB } from "@/databaseConnectionProvider";

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
  const [query, setQuery] = useState<Query | null>(null);
  const [queryContent, setQueryContent] = useState("");
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

  // Enhanced handleGeneratedQueryChange specifically for the popover
  const handleGeneratedQueryChange = useCallback(
    (value: string) => {
      if (currentQuery) {
        const updatedQuery = {
          ...currentQuery,
          query: value,
        };
        updateQuery(updatedQuery);
        // Also update local state to ensure consistency
        setQuery(updatedQuery);
      }
    },
    [currentQuery, updateQuery]
  );

  useEffect(() => {
    if (currentQuery) {
      setQueryContent(currentQuery?.query);
    }
  }, [currentQuery]);

  // Handle container resize to update Monaco layout
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    handleChange(queryContent);
  }, [queryContent]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      console.log("Run query →", editor.getValue())
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () =>
      editor.trigger("keyboard", "editor.action.triggerSuggest", undefined)
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
  };

  if (databases.length === 0) {
    return (
      <div className="flex flex-1 justify-center items-center flex-col gap-2 text-zinc-400">
        Create a connection to get started
        <AddDatabaseButton size="default" />
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="flex flex-1 justify-center items-center flex-col gap-2 text-zinc-400">
        Create a query to get started
        <NewQueryButton size="default" />
      </div>
    );
  }

  async function handleRunQuery() {
    if (currentQuery && currentConnection) {
      await runQuery(currentConnection, currentQuery.query);
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
          {/* {query && <DBInformation db={query.connection} />} */}
          <div className="flex items-center gap-1">
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
                Run query <Kbd cmd="⌘R" />
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
            <GenerateQueryPopover
              isGenerating={thinking}
              setIsGenerating={setThinking}
              value={query?.query ?? ""}
              onChange={handleGeneratedQueryChange}
            >
              <Tooltip delayDuration={700}>
                <TooltipTrigger>
                  <Button variant="ghost" className="has-[>svg]:p-1.5 h-fit">
                    <Sparkles className="size-3.5 text-purple-500" />
                    {thinking && <Thinking className="text-xs" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Generate query <Kbd cmd="⌘G" />
                </TooltipContent>
              </Tooltip>
            </GenerateQueryPopover>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0">
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
              // Key options to fix the resizing issue:
              automaticLayout: true, // Automatically layout when container resizes
              scrollBeyondLastLine: false,
              overviewRulerLanes: 0, // Disable overview ruler
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              // Prevent Monaco from interfering with mouse events outside the editor
              mouseWheelZoom: false,
              contextmenu: false, // Disable right-click menu to prevent event conflicts
            }}
            className="bg-zinc-950"
          />
        </div>
      </div>

      <EditorAgent
        query={queryContent}
        onQueryChange={setQueryContent}
        thinking={thinking}
        setThinking={setThinking}
      />
    </div>
  );
}

function EditorAgent({
  query,
  onQueryChange,
  thinking,
  setThinking,
}: {
  query: string;
  onQueryChange: React.Dispatch<SetStateAction<string>>;
  thinking: boolean;
  setThinking: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { runQuery, currentQuery, queryMessages } = useQueryData();
  const { settings, databases } = useAppData();
  const [collapsed, setCollapsed] = useState(
    parseBool(localStorage.getItem("editorAgentOpen"))
  );
  const [input, setInput] = useState("");
  const [model, setModel] = useState<TomeAgentModel>("gpt-4o");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const { connect, connected } = useDB();

  useEffect(() => {
    setMessages(queryMessages);
    console.log(queryMessages);
  }, [queryMessages]);

  useEffect(() => {
    localStorage.setItem("editorAgentOpen", String(collapsed));
  }, [collapsed]);

  async function sendMessage() {
    setThinking(true);
    setInput("");
    if (!currentQuery) return;
    const msg = await window.messages.createMessage({
      content: input,
      conversation: null,
      query: currentQuery.id,
      role: "user",
      toolCallId: null,
      toolCallStatus: null,
    });
    const newMessages: ConversationMessage[] = [...messages, msg];
    setMessages(newMessages);
    if (
      !settings?.aiFeatures.enabled ||
      !settings.aiFeatures.provider ||
      !settings.aiFeatures.apiKey
    )
      return;

    const queryObject = z.object({
      queryInstrucions: z
        .string()
        .describe("Instructions on what query to generate"),
    });

    async function getConnection(connectionName: string, connectionId: number) {
      let conn =
        connected.find(
          (i) => i.name === connectionName && i.id === connectionId
        ) ?? null;
      if (!conn) {
        const db = databases.find((i) => i.id === connectionId);
        if (!db) {
          throw new Error(`Could not find ${connectionId}`);
        }
        conn = await connect(db);
      }
      if (!conn) {
        throw new Error(
          `Could not connect to ${connectionId}:${connectionName}`
        );
      }
      return conn;
    }

    async function getFullSchema(connectionName: string, connectionId: number) {
      const conn = await getConnection(connectionName, connectionId);
      const schema = await window.db.getFullSchema(conn);
      return schema;
    }

    async function executeQuery(
      connectionName: string,
      connectionId: number,
      query: string
    ) {
      const conn = await getConnection(connectionName, connectionId);
      const res = await runQuery(conn, query);
      return res && "error" in res
        ? res
        : { totalCount: res?.rowCount, records: res?.rows.splice(0, 5) ?? [] };
    }

    const tools: ToolMap = {
      updateQuery: tool({
        description: "A secondary agent to use to update the query",
        parameters: queryObject,
        execute: async ({ queryInstrucions }) => {
          if (
            !settings.aiFeatures.enabled ||
            !settings.aiFeatures.apiKey ||
            !settings.aiFeatures.provider
          )
            return;
          const streamResult = streamResponse({
            apiKey: settings.aiFeatures.apiKey,
            model,
            toolCallStreaming: true,
            provider: settings.aiFeatures.provider,

            messages: [{ role: "user", content: queryInstrucions }],
            system: `You are a helpful database administrator embedded in a database client. You are provided with instructions on what query to generate and you are to generate the query only. No prose or backticks. Include 2 new lines at the end`,
            onChunk: ({ chunk }) => {
              if (chunk.type === "text-delta") {
                onQueryChange((prev) => prev + chunk.textDelta);
              }
            },
          });
          await streamResult.consumeStream();
          return await streamResult.text;
        },
      }),
      runQuery: tool({
        description:
          "Run a SQL query and return JSON rows. Select the most likely relevant connection from <databases> that should be used in the query",
        parameters: z.object({
          query: z.string(),
          connectionId: z
            .number()
            .describe("The connection ID from the database list"),
          connectionName: z
            .string()
            .describe("The connection name from the database list"),
        }),
        execute: async ({ query, connectionId, connectionName }) =>
          JSON.stringify(
            await executeQuery(connectionName, connectionId, query)
          ),
      }),
      getSchema: tool({
        description:
          "Gets the full schema for a given connection. Used to get more context about the db you're querying to know what tables/columns you have access to",
        parameters: z.object({
          connectionId: z
            .number()
            .describe("The connection ID from the database list"),
          connectionName: z
            .string()
            .describe("The connection name from the database list"),
        }),
        execute: async ({ connectionId, connectionName }) =>
          JSON.stringify(await getFullSchema(connectionName, connectionId)),
      }),
    };

    const streamResult = streamResponse({
      apiKey: settings.aiFeatures.apiKey,
      model,
      toolCallStreaming: true,
      provider: settings.aiFeatures.provider,
      tools,
      messages: newMessages
        .filter((i) => i.role !== "tool-call")
        .map((k) => ({
          ...k,
          role: k.role as "user" | "assistant",
        })),
      system: `You are a helpful database administrator embedded in a database client. Assist the user with any help they need with their database. This is the current query ${query}. The available databases are ${JSON.stringify(
        databases,
        null,
        2
      )} TOOL USE INSTRUCTIONS:\n1. When a user asks you to write a query, generally default to updating it by using the updateQuery tool \n2. Default to not outputting the query, the update query tool is updating the query within a code editor embedded in the client that is visible to the user.\n3. Use the getSchema tool to get the full schema from the database to assist you in writing the query.`,
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") {
          setMessages((m) => {
            const { textDelta } = chunk;
            const last = m[m.length - 1];
            // Check if we should append to existing assistant message
            if (last?.role === "assistant" && !(last as any).toolTag) {
              return [
                ...m.slice(0, -1),
                { ...last, content: last.content + textDelta },
              ];
            }
            return [
              ...m,
              {
                id: Date.now(),
                role: "assistant",
                content: textDelta,
                createdAt: new Date(),
                conversation: null,
                query: currentQuery.id,
                toolCallId: null,
                toolCallStatus: null,
              },
            ];
          });
        }

        if (chunk.type === "tool-call-streaming-start") {
          setMessages((m) => {
            const { toolName, toolCallId } = chunk;
            return [
              ...m,
              {
                id: Date.now(),
                role: "tool-call",
                content: toolName,
                toolCallId,
                toolCallStatus: "pending",
                createdAt: new Date(),
                conversation: null,
                query: currentQuery.id,
              },
            ];
          });
        }

        if (chunk.type === "tool-call") {
          const { toolCallId, toolName } = chunk;

          setMessages((prevMsgs) => {
            const toolMsg = prevMsgs.find((i) => i.toolCallId === toolCallId);

            if (!toolMsg) {
              console.warn(`Tool message with ID ${toolCallId} not found`);
              return prevMsgs;
            }

            const updatedMsg: ConversationMessage = {
              ...toolMsg,
              toolCallStatus: "complete",
            };

            return prevMsgs.map((msg) =>
              msg.toolCallId === toolCallId ? updatedMsg : msg
            );
          });
          if (currentQuery) {
            window.messages.createMessage({
              content: `Called ${toolName}`,
              query: currentQuery?.id,
              role: "tool-call",
              toolCallId: toolCallId,
              toolCallStatus: "complete",
              conversation: null,
            });
          }
        }
      },
      onFinish: ({ text }) => {
        console.log(text);
        if (currentQuery) {
          window.messages.createMessage({
            content: text,
            query: currentQuery?.id,
            role: "assistant",
            toolCallId: null,
            toolCallStatus: null,
            conversation: null,
          });
        }
      },
    });

    await streamResult.consumeStream();

    setThinking(false);
  }

  return (
    <ResizableContainer
      isCollapsed={collapsed}
      onCollapsedChange={setCollapsed}
      defaultSize={224}
      minSize={40}
      maxSize={800}
      snapThreshold={60}
      side="left"
      className="h-full border-l rounded-l-lg"
    >
      {collapsed && (
        <Button
          onClick={() => setCollapsed((prev) => !prev)}
          variant="ghost"
          className="has-[>svg]:px-1.5 left-1 relative text-zinc-400"
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
            thinking={thinking}
            messages={messages}
            input={input}
            model={model}
            setInput={setInput}
            setModel={setModel}
            sendMessage={sendMessage}
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
        "min-w-30 p-1 h-8 text-[0.7rem] border w-fit pl-3 pr-2 flex gap-2 justify-between items-center font-mono transition-all cursor-pointer",
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

// Main QueryTabs Component
function QueryTabs() {
  const { queries, deleteQuery, setCurrrentQuery, currentQuery, updateQuery } =
    useQueryData();

  return (
    <div className="border-b flex overflow-x-auto min-h-8">
      {queries.map((query) => (
        <QueryTab
          key={query.id}
          query={query}
          isSelected={currentQuery?.id === query.id}
          onSelect={setCurrrentQuery}
          onDelete={deleteQuery}
          onUpdate={updateQuery}
        />
      ))}
    </div>
  );
}
export function GenerateQueryPopover({
  setIsGenerating,
  isGenerating,
  children,
  value,
  onChange,
}: {
  setIsGenerating: React.Dispatch<SetStateAction<boolean>>;
  isGenerating: boolean;
  children: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
}) {
  const { currentQuery, currentConnection } = useQueryData();

  const [schema, setSchema] = useState<DatabaseSchema | null>(null);

  const { settings } = useAppData();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const [loadingSchema, setLoadingSchema] = useState(false);

  async function submit() {
    setOpen(false);
    if (
      !settings?.aiFeatures ||
      !settings.aiFeatures.provider ||
      !settings.aiFeatures.apiKey
    ) {
      return;
    }

    setIsGenerating(true);

    try {
      const streamResult = streamResponse({
        apiKey: settings.aiFeatures.apiKey,
        provider: settings.aiFeatures.provider,
        model: "gpt-4o",
        prompt: `${value}\n${input}`,
        system: `You are a SQL query generator. Generate a SQL query based on the user's request. Only return the SQL query without any additional text or formatting. Do not include backticks or \`\`\`sql tags, you're working directly in an editor. \n GUIDELINES: 1. Remember when using postgres and you encounter a column in camel case, it MUST be surrounded by double quotes.\n2. Do NOT include placeholder values, all queries must be valid  \n See below for the full database schema and connection information:\nEngine:\n${
          currentConnection?.engine
        }\n${JSON.stringify(schema, null, 2)}`,
      });

      // Start with empty content and build it up
      let generatedContent = "";

      for await (const textPart of streamResult.textStream) {
        generatedContent += textPart;
        // Update the current query with the accumulated content
        onChange(generatedContent);
      }

      // Reset input after successful generation
      setInput("");
    } catch (error) {
      console.error("Error generating query:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  async function getFullSchema() {
    setLoadingSchema(true);
    if (!currentQuery) return;
    const connection = await window.db.getDatabase(currentQuery.connection);
    const _schema = await window.db.getFullSchema(connection);
    setSchema(_schema);
    setLoadingSchema(false);
  }

  useEffect(() => {
    getFullSchema();
  }, [currentQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent className="dark text-sm space-y-2">
        <h2 className="font-bold">Generate Query</h2>
        <Textarea
          disabled={loadingSchema}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            loadingSchema
              ? "Loading schema..."
              : "What would you like to query?"
          }
          autoFocus
        />
        <Button
          className="w-full"
          size="xs"
          variant="secondary"
          onClick={submit}
          disabled={isGenerating || !input.trim()}
        >
          {isGenerating ? "Generating..." : "Generate Query"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
