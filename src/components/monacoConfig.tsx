import * as monacoEditor from "monaco-editor";
import { DatabaseSchema } from "core/database";
import { OnMount } from "@monaco-editor/react";

export interface TableInfo {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
  }>;
}

export interface SchemaCompletionProvider {
  schema: DatabaseSchema | null;
  currentConnection: any;
}

export function createSchemaCompletionProvider(
  schema: DatabaseSchema | null,
  currentConnection: any
): monacoEditor.languages.CompletionItemProvider {
  return {
    triggerCharacters: [" ", ".", "\n", "\t"],

    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const line = model.getLineContent(position.lineNumber);
      const lineUpToPosition = line.substring(0, position.column - 1);

      const range: monacoEditor.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: monacoEditor.languages.CompletionItem[] = [];

      // Add SQL keywords
      const sqlKeywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "JOIN",
        "INNER JOIN",
        "LEFT JOIN",
        "RIGHT JOIN",
        "ORDER BY",
        "GROUP BY",
        "HAVING",
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE",
        "ALTER",
        "DROP",
        "INDEX",
        "PRIMARY KEY",
        "FOREIGN KEY",
        "REFERENCES",
        "AND",
        "OR",
        "NOT",
        "IN",
        "EXISTS",
        "BETWEEN",
        "LIKE",
        "IS NULL",
        "IS NOT NULL",
        "COUNT",
        "SUM",
        "AVG",
        "MIN",
        "MAX",
        "DISTINCT",
        "AS",
        "LIMIT",
        "OFFSET",
      ];

      sqlKeywords.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          kind: monacoEditor.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
          sortText: `0_${keyword}`, // Prioritize keywords
        });
      });

      if (!schema?.schemas?.[0]?.tables) {
        return { suggestions };
      }

      const tables = schema.schemas[0].tables;
      const isPostgres = currentConnection?.engine === "postgresql";

      // Helper function to quote identifiers for PostgreSQL if needed
      const quoteIdentifier = (name: string): string => {
        if (isPostgres && /[A-Z]/.test(name)) {
          return `"${name}"`;
        }
        return name;
      };

      // Check context to determine what to suggest
      const lowerLine = lineUpToPosition.toLowerCase();

      // After FROM, JOIN, UPDATE, DELETE FROM, INSERT INTO - suggest tables
      if (
        /\b(from|join|update|delete\s+from|insert\s+into)\s+$/i.test(
          lineUpToPosition
        )
      ) {
        tables.forEach((table) => {
          const quotedTableName = quoteIdentifier(table.table);
          suggestions.push({
            label: table.table,
            kind: monacoEditor.languages.CompletionItemKind.Class,
            insertText: quotedTableName,
            range,
            detail: `Table with ${table.columns.length} columns`,
            documentation: `Columns: ${table.columns
              .map((c) => c.name)
              .join(", ")}`,
            sortText: `1_${table.table}`,
          });
        });
      }

      // After SELECT, or after comma in SELECT - suggest columns and table.column
      if (/\bselect\s+/i.test(lowerLine) || /,\s*$/i.test(lineUpToPosition)) {
        // Add all columns from all tables (unqualified)
        tables.forEach((table) => {
          table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);
            suggestions.push({
              label: column.name,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: quotedColumnName,
              range,
              detail: `${column.type}${
                column.nullable ? " (nullable)" : " (not null)"
              }`,
              documentation: `Column from table ${table.table}`,
              sortText: `2_${column.name}`,
            });
          });
        });

        // Add qualified column names (table.column)
        tables.forEach((table) => {
          table.columns.forEach((column) => {
            const quotedTableName = quoteIdentifier(table.table);
            const quotedColumnName = quoteIdentifier(column.name);
            const qualifiedName = `${quotedTableName}.${quotedColumnName}`;

            suggestions.push({
              label: `${table.table}.${column.name}`,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: qualifiedName,
              range,
              detail: `${column.type}${
                column.nullable ? " (nullable)" : " (not null)"
              }`,
              documentation: `${table.table}.${column.name}`,
              sortText: `3_${table.table}_${column.name}`,
            });
          });
        });
      }

      // Table name followed by dot - suggest columns for that table
      const tableColumnMatch = lineUpToPosition.match(/(\w+)\.$/);
      if (tableColumnMatch) {
        const tableName = tableColumnMatch[1];
        const table = tables.find(
          (t) =>
            t.table.toLowerCase() === tableName.toLowerCase() ||
            quoteIdentifier(t.table).toLowerCase() === tableName.toLowerCase()
        );

        if (table) {
          table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);
            suggestions.push({
              label: column.name,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: quotedColumnName,
              range,
              detail: `${column.type}${
                column.nullable ? " (nullable)" : " (not null)"
              }`,
              documentation: `Column from table ${table.table}`,
              sortText: `1_${column.name}`,
            });
          });
        }
      }

      // After WHERE, HAVING, ON - suggest columns and table.column
      if (/\b(where|having|on)\s+/i.test(lowerLine)) {
        tables.forEach((table) => {
          table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);
            const quotedTableName = quoteIdentifier(table.table);

            // Unqualified column
            suggestions.push({
              label: column.name,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: quotedColumnName,
              range,
              detail: `${column.type} from ${table.table}`,
              sortText: `2_${column.name}`,
            });

            // Qualified column
            suggestions.push({
              label: `${table.table}.${column.name}`,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: `${quotedTableName}.${quotedColumnName}`,
              range,
              detail: `${column.type}`,
              sortText: `3_${table.table}_${column.name}`,
            });
          });
        });
      }

      // Suggest table names for general context
      tables.forEach((table) => {
        const quotedTableName = quoteIdentifier(table.table);
        suggestions.push({
          label: table.table,
          kind: monacoEditor.languages.CompletionItemKind.Class,
          insertText: quotedTableName,
          range,
          detail: `Table with ${table.columns.length} columns`,
          documentation: `Columns: ${table.columns
            .slice(0, 5)
            .map((c) => c.name)
            .join(", ")}${table.columns.length > 5 ? "..." : ""}`,
          sortText: `4_${table.table}`,
        });
      });

      return { suggestions };
    },
  };
}

// Enhanced handleMount function for your SqlEditor component
export const createEnhancedHandleMount = (
  schema: DatabaseSchema | null,
  currentConnection: any
): OnMount => {
  return (editor, monaco) => {
    // Store editor reference
    // editorRef.current = editor;

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      console.log("Run query →", editor.getValue())
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () =>
      editor.trigger("keyboard", "editor.action.triggerSuggest", undefined)
    );

    // Register the schema-based completion provider
    const disposable = monaco.languages.registerCompletionItemProvider(
      "sql",
      createSchemaCompletionProvider(schema, currentConnection)
    );

    // Store disposable for cleanup if needed
    // You might want to store this in a ref to dispose of it when component unmounts

    // Define custom theme
    monaco.editor.defineTheme("zinc-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        // Add SQL syntax highlighting rules
        { token: "keyword.sql", foreground: "#C586C0" },
        { token: "string.sql", foreground: "#CE9178" },
        { token: "number.sql", foreground: "#B5CEA8" },
        { token: "comment.sql", foreground: "#6A9955" },
      ],
      colors: {
        "editor.background": "#09090b",
        "editorGutter.background": "#09090b",
        "editorLineNumber.foreground": "#4b5563",
        "editorLineNumber.activeForeground": "#f4f4f5",
      },
    });

    monaco.editor.setTheme("zinc-dark");

    // Return disposable for cleanup
    return disposable;
  };
};

// Usage in your SqlEditor component:
/*
// In your SqlEditor component, replace the handleMount function:

const handleMount: OnMount = createEnhancedHandleMount(schema, currentConnection);

// And make sure to update the completion provider when schema changes:
useEffect(() => {
  if (editorRef.current && schema) {
    // Dispose of old provider and register new one
    const monaco = (window as any).monaco;
    if (monaco) {
      // You might want to keep track of disposables to clean them up
      monaco.languages.registerCompletionItemProvider(
        "sql", 
        createSchemaCompletionProvider(schema, currentConnection)
      );
    }
  }
}, [schema, currentConnection]);
*/
