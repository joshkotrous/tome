import {
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";

import * as monacoEditor from "monaco-editor";
import { FileCode, Play, Plus, RefreshCcw, X } from "lucide-react";
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
import { streamResponse, TomeAgentModel, ToolMap } from "../../core/ai";
import { DatabaseSchema } from "core/database";
import ResizableContainer from "./ui/resizableContainer";
import { ConversationMessage, Query } from "@/types";
import { z } from "zod";
import { tool } from "ai";
import { DBInformation } from "./sidebar";
import { createSchemaCompletionProvider } from "./monacoConfig";

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
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
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

  useEffect(() => {
    if (currentQuery) {
      setQueryContent(currentQuery?.query);
    }
  }, [currentQuery]);

  async function getData() {
    if (currentConnection) {
      const _schema = await window.db.getFullSchema(currentConnection);
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

  const handleMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;
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
    const _schema = await window.db.getFullSchema(currentConnection);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      console.log("Run query →", editor.getValue())
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
          {currentConnection && <DBInformation db={currentConnection} />}
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
            {/* <GenerateQueryPopover
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
            </GenerateQueryPopover> */}
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

function addLineNumbers(str: string) {
  const lines = str.split("\n");
  const maxLineNumber = lines.length;
  const padding = String(maxLineNumber).length;

  return lines
    .map((line, i) => {
      const lineNumber = String(i + 1).padStart(padding, " ");
      return `${lineNumber} | ${line}`;
    })
    .join("\n");
}

function EditorAgent({
  schema,
  query,
  onQueryChange,
  thinking,
  setThinking,
}: {
  schema: DatabaseSchema | null;
  query: string;
  onQueryChange: React.Dispatch<SetStateAction<string>>;
  thinking: boolean;
  setThinking: React.Dispatch<SetStateAction<boolean>>;
}) {
  const {
    runQuery,
    currentQuery,
    queryMessages,
    currentConnection,
    connect,
    connected,
  } = useQueryData();
  const { settings, databases } = useAppData();
  const [collapsed, setCollapsed] = useState(
    parseBool(localStorage.getItem("editorAgentOpen"))
  );
  const [input, setInput] = useState("");
  const [model, setModel] = useState<TomeAgentModel>({
    provider: "Open AI",
    name: "gpt-4o",
  });
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    setMessages(queryMessages);
  }, [queryMessages]);

  useEffect(() => {
    localStorage.setItem("editorAgentOpen", String(collapsed));
  }, [collapsed]);

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
      throw new Error(`Could not connect to ${connectionId}:${connectionName}`);
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
      (!settings.aiFeatures.providers.openai.enabled &&
        !settings.aiFeatures.providers.anthropic.enabled)
    )
      return;

    const queryObject = z.object({
      query: z.string().describe("The new query to replace or apppend"),
      mode: z
        .enum(["append", "replace"])
        .describe(
          "Whether to append the existing query or replace it from the whole thing.  If mode is append, only the new query snippet that should be applied. Dont include the existing query"
        ),
    });

    const tools: ToolMap = {
      updateQuery: tool({
        description:
          "Update the query by either replacing the entire query or appending to it.",
        parameters: queryObject,
        execute: async ({ query: newQuery, mode }) => {
          if (
            !settings?.aiFeatures.enabled ||
            (!settings.aiFeatures.providers.openai.enabled &&
              !settings.aiFeatures.providers.anthropic.enabled)
          )
            return;

          if (mode === "replace") {
            // Clear query first
            onQueryChange("");

            // Add a small delay to ensure clearing is processed
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Split the new query into lines
            const queryLines = newQuery.split("\n");

            // Sequentially add each line
            for (let i = 0; i < queryLines.length; i++) {
              const line = queryLines[i];
              const isLastLine = i === queryLines.length - 1;

              onQueryChange((prev) => {
                // Add the line and a newline (except for the last line to avoid trailing newline)
                return prev + line + (isLastLine ? "" : "\n");
              });

              // Small delay between each line for visual effect
              await new Promise((resolve) => setTimeout(resolve, 20));
            }

            return `Successfully replaced the entire query with new content.`;
          } else if (mode === "append") {
            // Add newlines to separate from existing content if query is not empty
            const separator = query.trim() ? "\n\n" : "";
            const contentToAppend = separator + newQuery;
            const appendLines = contentToAppend.split("\n");

            // Sequentially add each line of the appended content
            for (let i = 0; i < appendLines.length; i++) {
              const line = appendLines[i];
              const isLastLine = i === appendLines.length - 1;

              onQueryChange((prev) => {
                // Add the line and a newline (except for the last line to avoid trailing newline)
                return prev + line + (isLastLine ? "" : "\n");
              });

              // Small delay between each line for visual effect
              await new Promise((resolve) => setTimeout(resolve, 20));
            }

            return `Successfully appended new content to the existing query.`;
          }

          return "Invalid mode specified. Use 'replace' or 'append'.";
        },
      }),
      updateQuerySection: tool({
        description: "Use to update a section of the query",
        parameters: z.object({
          querySnippet: z
            .string()
            .describe("The new query snippet with updates applied"),
          startLine: z
            .number()
            .describe(
              "The start line where the update should be made (1-based)"
            ),
          endLine: z
            .number()
            .describe("The end line where the update should be made (1-based)"),
        }),
        execute: async ({ querySnippet, startLine, endLine }) => {
          const queryLines = query.split("\n");

          const startIndex = Math.max(0, startLine - 1);
          const endIndex = Math.max(0, endLine - 1);

          if (startIndex >= queryLines.length) {
            throw new Error(
              `Start line ${startLine} is beyond the query length (${queryLines.length} lines)`
            );
          }

          if (endIndex >= queryLines.length) {
            throw new Error(
              `End line ${endLine} is beyond the query length (${queryLines.length} lines)`
            );
          }

          if (startLine > endLine) {
            throw new Error(
              `Start line ${startLine} cannot be greater than end line ${endLine}`
            );
          }

          const snippetLines = querySnippet.split("\n");

          const beforeLines = queryLines.slice(0, startIndex);
          const afterLines = queryLines.slice(endIndex + 1);

          const baseQuery = [
            ...beforeLines,
            ...new Array(snippetLines.length).fill(""),
            ...afterLines,
          ].join("\n");

          onQueryChange(baseQuery);

          await new Promise((resolve) => setTimeout(resolve, 10));

          for (let i = 0; i < snippetLines.length; i++) {
            const snippetLine = snippetLines[i];
            const targetLineIndex = startIndex + i;

            onQueryChange((prev) => {
              const lines = prev.split("\n");
              lines[targetLineIndex] = snippetLine;
              return lines.join("\n");
            });

            await new Promise((resolve) => setTimeout(resolve, 20));
          }

          return `Successfully updated lines ${startLine}-${endLine} with the new query snippet.`;
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
      apiKey:
        model.provider === "Open AI"
          ? settings.aiFeatures.providers.openai.apiKey
          : settings.aiFeatures.providers.anthropic.apiKey,
      model: model.name,
      toolCallStreaming: true,
      provider: model.provider,
      tools,
      toolChoice: "required",
      messages: newMessages
        .filter((i) => i.role !== "tool-call")
        .map((k) => ({
          ...k,
          role: k.role as "user" | "assistant",
        })),
      system: `You are a helpful database administrator embedded in a database client. Assist the user with any help they need with their database.\nThis is the current query: <current_query>${addLineNumbers(
        query
      )}</current_query>.\nThe currently connected database is ${JSON.stringify(
        currentConnection,
        null,
        2
      )}
      

      This is the full schema: 
      ${JSON.stringify(schema, null, 2)}

      The current query within the tags is the query currently displayed in the editor. If the user asks questions about the current query, or without much context. This is the query they're talking about. In this case, dont refer to queries in previous messages unless specifically asked by the user. 
      BEHAVIOR GUIDELINES:
      1. When a user is asking about a query, they're asking about the contents query in the **editor**, which is within <current_query>. This should be the basis of any of your explanations.
      2. Only refer to queries in previous messages if specifically asked by the user. Again they're generally asking about the contents within the editor by default, which is stored in <current_query>

      TOOL USE INSTRUCTIONS:
      1. When a user asks you to write a query, generally default to updating it by using the updateQuery tool
      2. When asked to write a query dont output it, use the update query tool to update the query within the code editor embedded in the client that is visible to the user.
      3. Use the getSchema tool to get the full schema from the database to assist you in writing the query.
      4. When using the sub agent to generate a query, provide full and complete instructions with context from the schema to ensure it is production ready and works as expected.
      5. Use the runQuery tool to run the generated query and test to ensure its valid. If you encounter an error, update the query to fix it.
      6. If the query is initially empty or has to be completely rewritten, use the updateQuery tool to update the query using a subagent
      7. If only a piece of the query needs to be updated, use the updateQuerySection tool to only update that section with the applicable snippet replacement
      
      QUERY CONSIDERATIONS:
      1. If the engine is Postgres, any column names or table names in camel case MUST be surrounded by double quotes.`,
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
                content: `${toolName}`,
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
              content: `${toolName}`,
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
      className="h-full border-l rounded-l-lg bg-zinc-900/50"
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
            showQueryControls
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
    <div className="border-b flex overflow-x-auto min-h-8 items-center ">
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
