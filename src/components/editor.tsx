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
import { Query, useQueryData } from "@/queryDataProvider";
import { useAppData } from "@/applicationDataProvider";
import AddDatabaseButton from "./addDatabaseButton";
import { cn } from "@/lib/utils";
import { DBInformation } from "./sidebar";
import ChatInterface, { ChatInputDisplay, Thinking } from "./chatInterface";
import { Switch } from "./ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { streamResponse, TomeAgentModel } from "../../core/ai";
import { DatabaseSchema } from "core/database";
import ResizableContainer from "./ui/resizableContainer";
import { ConversationMessage } from "@/types";

export default function QueryInterface() {
  const { agentModeEnabled, setAgentModeEnabled, settings } = useAppData();

  useEffect(() => {}, [settings]);

  return (
    <div className="flex-1 min-h-0 size-full bg-zinc-950 rounded-t-md flex flex-col">
      <div className="border-b p-2 h-8 flex justify-end">
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

      <AnimatePresence mode="wait">
        {agentModeEnabled ? (
          <motion.div
            key="chat-interface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex-1 h-full"
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
            className="flex-1 flex flex-col size-full"
          >
            <SqlEditor />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SqlEditor() {
  const { queries, currentQuery, runQuery, updateQuery } = useQueryData();
  const [query, setQuery] = useState<Query | null>(null);
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
    const _query = queries.find((i) => i.id === currentQuery?.id);
    if (_query) {
      setQuery(_query);
    }
  }, [queries, currentQuery]);

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
    if (currentQuery && query) {
      await runQuery(query);
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
          {query && <DBInformation db={query.connection} />}
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
            value={query?.query ?? ""}
            onChange={handleChange}
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
        query={query?.query ?? ""}
        onQueryChange={handleGeneratedQueryChange}
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
  onQueryChange: (val: string) => void;
  thinking: boolean;
  setThinking: React.Dispatch<SetStateAction<boolean>>;
}) {
  const { settings } = useAppData();
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<TomeAgentModel>("gpt-4o");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  async function sendMessage() {
    setThinking(true);
    setInput("");
    const newMessages: ConversationMessage[] = [
      ...messages,
      {
        id: 0,
        content: input,
        conversation: 0,
        createdAt: new Date(),
        role: "user",
      },
    ];
    setMessages(newMessages);
    if (
      !settings?.aiFeatures.enabled ||
      !settings.aiFeatures.provider ||
      !settings.aiFeatures.apiKey
    )
      return;
    const streamResult = streamResponse({
      apiKey: settings.aiFeatures.apiKey,
      model,
      provider: settings.aiFeatures.provider,
      messages: newMessages,
      system: `You are a helpful database administrator embedded in a database client. Assist the user with any help they need with their database. This is the current query ${query}. Output your prose then if required to generate a query, output it at the very end of your repsonse within <query></query> tags`,
    });
    for await (const textPart of streamResult.textStream) {
      setMessages((m) => {
        const last = m[m.length - 1];
        // append or start new chunk
        if (last?.role === "assistant" && !(last as any).toolTag) {
          return [
            ...m.slice(0, -1),
            { ...last, content: last.content + textPart },
          ];
        }
        return [
          ...m,
          {
            id: 1,
            role: "assistant",
            content: textPart,
            createdAt: new Date(),
            conversation: 0,
          },
        ];
      });
    }
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

function QueryTabs() {
  const { queries, deleteQuery, setCurrrentQuery, currentQuery } =
    useQueryData();

  return (
    <div className="border-b flex overflow-x-auto min-h-8">
      {queries.map((i) => {
        const selected = currentQuery?.id === i.id;
        return (
          <div
            key={i.id}
            onClick={() => setCurrrentQuery(i)}
            className={cn(
              "min-w-30 p-1 h-8 text-[0.7rem] border w-fit pl-3 pr-2 flex gap-2 justify-between items-center font-mono transition-all cursor-pointer",
              selected && "bg-zinc-800/75"
            )}
          >
            {i.connection.name}
            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <X
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteQuery(i);
                  }}
                  className="size-3 hover:text-red-500 transition-all"
                />
              </TooltipTrigger>
              <TooltipContent>
                Close file <Kbd cmd="⌘W" />
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
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
  const { currentQuery } = useQueryData();

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
          currentQuery?.connection.engine
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
    const _schema = await window.db.getFullSchema(currentQuery?.connection);
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
