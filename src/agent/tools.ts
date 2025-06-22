import { Tool, tool } from "ai";
import { ToolMap } from "core/ai";
import { SetStateAction } from "react";
import { z } from "zod";

const queryObject = z.object({
  query: z.string().describe("The new query to replace or apppend"),
  mode: z
    .enum(["append", "replace"])
    .describe(
      "Whether to append the existing query or replace it from the whole thing.  If mode is append, only the new query snippet that should be applied. Dont include the existing query"
    ),
});

export function getAgentTools({
  query,
  setQuery,
  runQueryFn,
  getSchemaFn,
}: {
  query?: string;
  setQuery?: React.Dispatch<SetStateAction<string>>;
  runQueryFn: (
    connectionName: string,
    connectionId: number,
    query: string
  ) => any;
  getSchemaFn: (connectionName: string, connectionId: number) => any;
}): ToolMap {
  let updateQuery: Tool<any, any> | undefined = undefined;
  let updateQuerySection: Tool<any, any> | undefined = undefined;

  if (setQuery && query !== undefined) {
    updateQuery = tool({
      description:
        "Update the query by either replacing the entire query or appending to it.",
      parameters: queryObject,
      execute: async ({ query: newQuery, mode }) => {
        if (mode === "replace") {
          // Clear query first
          setQuery("");

          // Add a small delay to ensure clearing is processed
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Split the new query into lines
          const queryLines = newQuery.split("\n");

          // Sequentially add each line
          for (let i = 0; i < queryLines.length; i++) {
            const line = queryLines[i];
            const isLastLine = i === queryLines.length - 1;

            setQuery((prev) => {
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

            setQuery((prev) => {
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
    });

    updateQuerySection = tool({
      description: "Use to update a section of the query",
      parameters: z.object({
        querySnippet: z
          .string()
          .describe("The new query snippet with updates applied"),
        startLine: z
          .number()
          .describe("The start line where the update should be made (1-based)"),
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

        setQuery(baseQuery);

        await new Promise((resolve) => setTimeout(resolve, 10));

        for (let i = 0; i < snippetLines.length; i++) {
          const snippetLine = snippetLines[i];
          const targetLineIndex = startIndex + i;

          setQuery((prev) => {
            const lines = prev.split("\n");
            lines[targetLineIndex] = snippetLine;
            return lines.join("\n");
          });

          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        return `Successfully updated lines ${startLine}-${endLine} with the new query snippet.`;
      },
    });
  }

  const runQuery = tool({
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
    execute: async ({ query, connectionId, connectionName }) => {
      return JSON.stringify(
        await runQueryFn(connectionName, connectionId, query)
      );
    },
  });

  const getSchema = tool({
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
    execute: async ({ connectionId, connectionName }) => {
      return JSON.stringify(await getSchemaFn(connectionName, connectionId));
    },
  });

  const askForPermission = tool({
    description: "Ask the user for permission to run destructive queries",
    parameters: z.object({}),
  });

  if (updateQuery && updateQuerySection) {
    return {
      updateQuery,
      updateQuerySection,
      runQuery,
      getSchema,
      askForPermission,
    };
  }

  return {
    runQuery,
    getSchema,
    askForPermission,
  };
}
