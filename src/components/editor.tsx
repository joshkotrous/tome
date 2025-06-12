import { useCallback, useEffect, useState } from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";

import * as monacoEditor from "monaco-editor";
import { Play, RefreshCcw, Sparkles, X } from "lucide-react";
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
import ChatInterface from "./chatInterface";
import { Switch } from "./ui/switch";
import { AnimatePresence, motion } from "framer-motion";

export default function QueryInterface() {
  const { agentModeEnabled, setAgentModeEnabled } = useAppData();

  return (
    <div className="flex-1 min-h-0 size-full bg-zinc-950 rounded-t-md flex flex-col">
      <div className="border-b p-2 flex justify-end">
        <div className="text-xs flex items-center gap-2">
          <Switch
            checked={agentModeEnabled}
            onCheckedChange={setAgentModeEnabled}
          />
          Agent Mode
        </div>
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
            className="flex-1 flex flex-col"
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

  const handleChange = useCallback(
    (value?: string) => {
      // If there's a current query, update it in the queries array
      if (currentQuery) {
        if (query) {
          const updatedQuery = {
            ...query,
            query: value ?? "",
          };
          updateQuery(updatedQuery);
        }
      }
    },
    [currentQuery, queries, updateQuery]
  );

  useEffect(() => {
    const _query = queries.find((i) => i.id === currentQuery);
    if (_query) {
      setQuery(_query);
    }
  }, [queries, currentQuery]);

  const handleMount: OnMount = (editor, monaco) => {
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
      rules: [], // syntax-token rules (leave empty for now)
      colors: {
        "editor.background": "#09090b", // zinc-950
        "editorGutter.background": "#09090b",
        // optional extras:
        "editorLineNumber.foreground": "#4b5563", // zinc-500
        "editorLineNumber.activeForeground": "#f4f4f5", // zinc-100
      },
    });

    /* 2️⃣  Activate it */
    monaco.editor.setTheme("zinc-dark");
  };

  // if (true) {
  //   return <ChatInterface />;
  // }

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
    if (currentQuery) {
      if (query) {
        await runQuery(query);
      }
    }
  }

  async function handleClearQuery() {
    if (currentQuery) {
      if (query) {
        updateQuery({ ...query, query: "" });
      }
    }
  }

  return (
    <>
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
          <GenerateQueryPopover>
            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <Button variant="ghost" className="has-[>svg]:p-1.5 h-fit">
                  <Sparkles className="size-3.5 text-purple-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Generate query <Kbd cmd="⌘G" />
              </TooltipContent>
            </Tooltip>
          </GenerateQueryPopover>
        </div>
      </div>

      <MonacoEditor
        height="100%"
        defaultLanguage="sql"
        theme="zinc-dark"
        value={queries.find((i) => i.id === currentQuery)?.query ?? ""}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          fontSize: 14,
          tabSize: 2,
        }}
        className="flex-1 bg-zinc-950"
      />
    </>
  );
}

function QueryTabs() {
  const { queries, deleteQuery, setCurrrentQuery, currentQuery } =
    useQueryData();
  return (
    <div className="border-b flex overflow-x-auto min-h-8">
      {queries.map((i) => {
        const selected = currentQuery === i.id;
        return (
          <div
            onClick={() => setCurrrentQuery(i.id)}
            className={cn(
              "min-w-30 p-1 h-8 text-[0.7rem] border w-fit pl-3 pr-2 flex gap-2 justify-between items-center font-mono transition-all",
              selected && "bg-zinc-800/75"
            )}
          >
            {i.connection.name}
            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <X
                  onClick={() => deleteQuery(i)}
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
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent className="dark text-sm space-y-2">
        <h2 className=" font-bold">Generate Query</h2>
        <Textarea placeholder="What would you like to query?" />
        <Button className="w-full" size="xs" variant="secondary">
          Generate Query
        </Button>
      </PopoverContent>
    </Popover>
  );
}
