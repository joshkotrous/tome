import { useState, useCallback } from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";

import * as monacoEditor from "monaco-editor";
import { Play, RefreshCcw, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Textarea } from "./ui/textarea";

export default function SqlEditor() {
  const [query, setQuery] = useState("");

  const handleChange = useCallback((value?: string) => {
    setQuery(value ?? "");
  }, []);

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

  return (
    <div className=" flex-1 min-h-0 size-full bg-zinc-950 rounded-t-md flex flex-col">
      <div className="border-b">
        <div className="min-w-30 p-1 h-8 text-[0.7rem] border w-fit pl-3 pr-2 flex gap-2 justify-between items-center font-mono">
          (untitled) <X className="size-3 hover:text-red-500 transition-all" />
        </div>
      </div>
      <div className="w-full border-b border-zinc-800 p-2 font-mono text-xs text-zinc-500 flex items-center gap-2">
        db info
        <div className="flex items-center gap-1">
          <Tooltip delayDuration={700}>
            <TooltipTrigger>
              <Button variant="ghost" className="has-[>svg]:p-1.5 h-fit">
                <Play className="size-3.5 text-green-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run query (cmd + r)</TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={700}>
            <TooltipTrigger>
              <Button variant="ghost" className="has-[>svg]:p-1.5 h-fit">
                <RefreshCcw className="size-3.5 text-amber-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear query (cmd + c)</TooltipContent>
          </Tooltip>
          <GenerateQueryPopover>
            <Tooltip delayDuration={700}>
              <TooltipTrigger>
                <Button variant="ghost" className="has-[>svg]:p-1.5 h-fit">
                  <Sparkles className="size-3.5 text-purple-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generate query (cmd + g)</TooltipContent>
            </Tooltip>
          </GenerateQueryPopover>
        </div>
      </div>

      <MonacoEditor
        height="100%"
        defaultLanguage="sql"
        theme="zinc-dark"
        value={query}
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
