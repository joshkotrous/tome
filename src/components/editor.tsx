import { useState, useCallback } from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";

import * as monacoEditor from "monaco-editor";

export default function SqlEditor() {
  const [query, setQuery] = useState("-- write your sql here");

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
      <div className="w-full border-b border-zinc-800 p-2 font-mono text-xs text-zinc-500">
        folder&nbsp;&nbsp;fileName.sql
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
