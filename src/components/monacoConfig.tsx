import * as monacoEditor from "monaco-editor";
import { OnMount } from "@monaco-editor/react";
import { DatabaseSchema, TableDef } from "core/connections";

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

// Comprehensive SQL keywords
const SQL_KEYWORDS = [
  // DQL (Data Query Language)
  "SELECT",
  "FROM",
  "WHERE",
  "AS",
  "DISTINCT",
  "ALL",
  // Joins
  "JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "LEFT OUTER JOIN",
  "RIGHT JOIN",
  "RIGHT OUTER JOIN",
  "FULL JOIN",
  "FULL OUTER JOIN",
  "CROSS JOIN",
  "NATURAL JOIN",
  "ON",
  "USING",
  // Grouping & Ordering
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "ASC",
  "DESC",
  "NULLS FIRST",
  "NULLS LAST",
  // Limiting
  "LIMIT",
  "OFFSET",
  "FETCH",
  "FIRST",
  "NEXT",
  "ROWS",
  "ONLY",
  "TOP",
  // Set operations
  "UNION",
  "UNION ALL",
  "INTERSECT",
  "EXCEPT",
  "MINUS",
  // Subqueries
  "IN",
  "NOT IN",
  "EXISTS",
  "NOT EXISTS",
  "ANY",
  "SOME",
  // Conditions
  "AND",
  "OR",
  "NOT",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "SIMILAR TO",
  "IS NULL",
  "IS NOT NULL",
  "IS TRUE",
  "IS FALSE",
  "IS UNKNOWN",
  // Case
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  // DML (Data Manipulation Language)
  "INSERT",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "DELETE FROM",
  "TRUNCATE",
  "MERGE",
  "UPSERT",
  "RETURNING",
  // DDL (Data Definition Language)
  "CREATE",
  "CREATE TABLE",
  "CREATE INDEX",
  "CREATE VIEW",
  "CREATE DATABASE",
  "CREATE SCHEMA",
  "ALTER",
  "ALTER TABLE",
  "DROP",
  "DROP TABLE",
  "DROP INDEX",
  "DROP VIEW",
  "RENAME",
  "ADD",
  "ADD COLUMN",
  "DROP COLUMN",
  "MODIFY",
  // Constraints
  "PRIMARY KEY",
  "FOREIGN KEY",
  "REFERENCES",
  "UNIQUE",
  "CHECK",
  "DEFAULT",
  "NOT NULL",
  "NULL",
  "CONSTRAINT",
  "INDEX",
  "CASCADE",
  "RESTRICT",
  "SET NULL",
  "SET DEFAULT",
  "NO ACTION",
  // Transactions
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "TRANSACTION",
  // Common Table Expressions
  "WITH",
  "RECURSIVE",
  // Window functions
  "OVER",
  "PARTITION BY",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "NTILE",
  "LAG",
  "LEAD",
  "FIRST_VALUE",
  "LAST_VALUE",
  "NTH_VALUE",
  // Aggregate functions
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "ARRAY_AGG",
  "STRING_AGG",
  "JSON_AGG",
  "JSONB_AGG",
  "COALESCE",
  "NULLIF",
  "GREATEST",
  "LEAST",
  // Data types
  "INT",
  "INTEGER",
  "BIGINT",
  "SMALLINT",
  "DECIMAL",
  "NUMERIC",
  "FLOAT",
  "REAL",
  "DOUBLE PRECISION",
  "VARCHAR",
  "CHAR",
  "TEXT",
  "BOOLEAN",
  "DATE",
  "TIME",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "INTERVAL",
  "UUID",
  "JSON",
  "JSONB",
  "ARRAY",
  "SERIAL",
  "BIGSERIAL",
];

// SQL functions
const SQL_FUNCTIONS = [
  // String functions
  "CONCAT",
  "SUBSTRING",
  "LENGTH",
  "CHAR_LENGTH",
  "UPPER",
  "LOWER",
  "TRIM",
  "LTRIM",
  "RTRIM",
  "REPLACE",
  "REVERSE",
  "LEFT",
  "RIGHT",
  "LPAD",
  "RPAD",
  "SPLIT_PART",
  "POSITION",
  "STRPOS",
  "INITCAP",
  "REPEAT",
  "FORMAT",
  // Numeric functions
  "ABS",
  "CEIL",
  "CEILING",
  "FLOOR",
  "ROUND",
  "TRUNC",
  "MOD",
  "POWER",
  "SQRT",
  "RANDOM",
  "SIGN",
  "LOG",
  "LN",
  "EXP",
  // Date/Time functions
  "NOW",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "CURRENT_TIMESTAMP",
  "DATE_TRUNC",
  "DATE_PART",
  "EXTRACT",
  "AGE",
  "DATE_ADD",
  "DATE_SUB",
  "DATEDIFF",
  "TO_CHAR",
  "TO_DATE",
  "TO_TIMESTAMP",
  // Conditional functions
  "COALESCE",
  "NULLIF",
  "GREATEST",
  "LEAST",
  "CASE",
  "IF",
  "IIF",
  "NVL",
  "NVL2",
  "DECODE",
  // Type conversion
  "CAST",
  "CONVERT",
  "TO_NUMBER",
  "TO_TEXT",
  // JSON functions
  "JSON_EXTRACT",
  "JSON_OBJECT",
  "JSON_ARRAY",
  "JSONB_EXTRACT_PATH",
  "JSONB_SET",
  // Array functions
  "ARRAY_LENGTH",
  "ARRAY_APPEND",
  "ARRAY_CAT",
  "UNNEST",
  "ANY",
  "ALL",
];

export function createSchemaCompletionProvider(
  schema: DatabaseSchema | null,
  currentConnection: any
): monacoEditor.languages.CompletionItemProvider {
  return {
    triggerCharacters: [" ", ".", "\n", "\t", ",", "("],

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
      const addedLabels = new Set<string>();

      // Helper to avoid duplicates
      const addSuggestion = (
        suggestion: monacoEditor.languages.CompletionItem
      ) => {
        const key = `${suggestion.label}-${suggestion.kind}`;
        if (!addedLabels.has(key)) {
          addedLabels.add(key);
          suggestions.push(suggestion);
        }
      };

      // Add SQL keywords
      SQL_KEYWORDS.forEach((keyword) => {
        addSuggestion({
          label: keyword,
          kind: monacoEditor.languages.CompletionItemKind.Keyword,
          insertText: keyword + " ",
          range,
          sortText: `0_${keyword.toLowerCase()}`,
        });
      });

      // Add SQL functions
      SQL_FUNCTIONS.forEach((func) => {
        addSuggestion({
          label: func,
          kind: monacoEditor.languages.CompletionItemKind.Function,
          insertText: func + "(",
          range,
          detail: "Function",
          sortText: `1_${func.toLowerCase()}`,
        });
      });

      // Collect all tables from all schemas
      const allTables: Array<{ schemaName: string; table: TableDef }> = [];
      if (schema?.schemas) {
        schema.schemas.forEach((schemaInfo) => {
          schemaInfo.tables.forEach((table) => {
            allTables.push({ schemaName: schemaInfo.name, table });
          });
        });
      }

      if (allTables.length === 0) {
        return { suggestions };
      }

      const isPostgres =
        currentConnection?.engine === "postgresql" ||
        currentConnection?.engine === "Postgres";
      const isMySql =
        currentConnection?.engine === "mysql" ||
        currentConnection?.engine === "MySQL";

      // Helper function to quote identifiers if needed
      const quoteIdentifier = (name: string): string => {
        // Quote if contains special characters or uppercase (for Postgres)
        if (isPostgres && /[A-Z]/.test(name)) {
          return `"${name}"`;
        }
        if (isMySql && /[^a-zA-Z0-9_]/.test(name)) {
          return `\`${name}\``;
        }
        return name;
      };

      // Check context to determine what to suggest
      const lowerLine = lineUpToPosition.toLowerCase();

      // After FROM, JOIN, UPDATE, DELETE FROM, INSERT INTO, INTO - suggest tables
      const afterTableKeyword =
        /\b(from|join|update|into|table)\s+$/i.test(lineUpToPosition) ||
        /\bdelete\s+from\s+$/i.test(lineUpToPosition) ||
        /\binsert\s+into\s+$/i.test(lineUpToPosition);

      if (afterTableKeyword) {
        allTables.forEach(({ schemaName, table }) => {
          const quotedTableName = quoteIdentifier(table.table);
          const fullTableName =
            schemaName && schemaName !== "public" && schemaName !== "main"
              ? `${quoteIdentifier(schemaName)}.${quotedTableName}`
              : quotedTableName;

          addSuggestion({
            label: table.table,
            kind: monacoEditor.languages.CompletionItemKind.Class,
            insertText: fullTableName,
            range,
            detail: `Table (${table.columns.length} columns)${schemaName ? ` in ${schemaName}` : ""}`,
            documentation: {
              value: `**Columns:**\n${table.columns.map((c) => `- \`${c.name}\` ${c.type}${c.nullable ? "" : " NOT NULL"}`).join("\n")}`,
            },
            sortText: `2_${table.table.toLowerCase()}`,
          });
        });
        return { suggestions };
      }

      // Table name or alias followed by dot - suggest columns for that table
      const tableColumnMatch = lineUpToPosition.match(
        /(?:^|[\s,])(\w+)\.$/i
      );
      if (tableColumnMatch) {
        const tableNameOrAlias = tableColumnMatch[1].toLowerCase();

        // Find matching table
        const matchingTable = allTables.find(
          ({ table }) => table.table.toLowerCase() === tableNameOrAlias
        );

        if (matchingTable) {
          // Clear other suggestions for cleaner context-specific completions
          suggestions.length = 0;
          addedLabels.clear();

          // Add * for selecting all columns
          addSuggestion({
            label: "*",
            kind: monacoEditor.languages.CompletionItemKind.Constant,
            insertText: "*",
            range,
            detail: "All columns",
            sortText: "0_*",
          });

          matchingTable.table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);
            addSuggestion({
              label: column.name,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: quotedColumnName,
              range,
              detail: `${column.type}${column.nullable ? " (nullable)" : " NOT NULL"}`,
              documentation: `Column from table ${matchingTable.table.table}`,
              sortText: `1_${column.name.toLowerCase()}`,
            });
          });
          return { suggestions };
        }
      }

      // After SELECT, or after comma - suggest columns and table.column
      const inSelectClause =
        /\bselect\s+/i.test(lowerLine) && !/\bfrom\b/i.test(lowerLine);
      const afterComma = /,\s*$/i.test(lineUpToPosition);

      if (inSelectClause || afterComma) {
        // Add * for selecting all
        addSuggestion({
          label: "*",
          kind: monacoEditor.languages.CompletionItemKind.Constant,
          insertText: "*",
          range,
          detail: "All columns",
          sortText: "2_*",
        });

        // Add all columns from all tables
        allTables.forEach(({ table }) => {
          table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);
            addSuggestion({
              label: column.name,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: quotedColumnName,
              range,
              detail: `${column.type} (${table.table})`,
              sortText: `3_${column.name.toLowerCase()}`,
            });
          });

          // Add qualified column names (table.column)
          const quotedTableName = quoteIdentifier(table.table);
          table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);
            addSuggestion({
              label: `${table.table}.${column.name}`,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: `${quotedTableName}.${quotedColumnName}`,
              range,
              detail: column.type,
              sortText: `4_${table.table.toLowerCase()}_${column.name.toLowerCase()}`,
            });
          });
        });
      }

      // After WHERE, HAVING, ON, AND, OR, SET - suggest columns
      const inConditionClause =
        /\b(where|having|on|and|or|set)\s+/i.test(lowerLine) ||
        /\b(where|having|on|and|or|set)\s+\w+\s*(=|<|>|!=|<>|<=|>=|like|ilike|in|between)\s*$/i.test(
          lowerLine
        );

      if (inConditionClause) {
        allTables.forEach(({ table }) => {
          const quotedTableName = quoteIdentifier(table.table);
          table.columns.forEach((column) => {
            const quotedColumnName = quoteIdentifier(column.name);

            // Unqualified column
            addSuggestion({
              label: column.name,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: quotedColumnName,
              range,
              detail: `${column.type} (${table.table})`,
              sortText: `3_${column.name.toLowerCase()}`,
            });

            // Qualified column
            addSuggestion({
              label: `${table.table}.${column.name}`,
              kind: monacoEditor.languages.CompletionItemKind.Field,
              insertText: `${quotedTableName}.${quotedColumnName}`,
              range,
              detail: column.type,
              sortText: `4_${table.table.toLowerCase()}_${column.name.toLowerCase()}`,
            });
          });
        });
      }

      // Always suggest table names as fallback
      allTables.forEach(({ table }) => {
        const quotedTableName = quoteIdentifier(table.table);
        addSuggestion({
          label: table.table,
          kind: monacoEditor.languages.CompletionItemKind.Class,
          insertText: quotedTableName,
          range,
          detail: `Table (${table.columns.length} columns)`,
          documentation: {
            value:
              table.columns.length <= 10
                ? `**Columns:** ${table.columns.map((c) => c.name).join(", ")}`
                : `**Columns:** ${table.columns
                    .slice(0, 10)
                    .map((c) => c.name)
                    .join(", ")}... (+${table.columns.length - 10} more)`,
          },
          sortText: `5_${table.table.toLowerCase()}`,
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
