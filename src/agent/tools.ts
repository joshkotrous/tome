import { Tool, tool } from "ai";
import { ToolMap } from "core/ai";
import { SetStateAction } from "react";
import { z } from "zod";
import { VisualizationConfig, VisualizationData } from "@/components/dataVisualization";

const queryObject = z.object({
  query: z.string().describe("The new query to replace or apppend"),
  mode: z
    .enum(["append", "replace"])
    .describe(
      "Whether to append the existing query or replace it from the whole thing.  If mode is append, only the new query snippet that should be applied. Dont include the existing query"
    ),
});

const visualizationConfigSchema = z.object({
  chartType: z.enum(["bar", "line", "pie", "area"]).describe(
    "The type of chart to render. Use 'bar' for comparing categories, 'line' for trends over time, 'area' for cumulative trends, 'pie' for proportions/percentages"
  ),
  xAxis: z.string().describe("The column name to use for the X axis (categories or time series)"),
  yAxis: z.union([z.string(), z.array(z.string())]).describe(
    "The column name(s) to use for the Y axis (values). Can be a single column or array for multiple series"
  ),
  title: z.string().optional().describe("A descriptive title for the visualization"),
  description: z.string().optional().describe("A brief description explaining what the visualization shows"),
});

export function getAgentTools({
  query,
  setQuery,
  runQueryFn,
  runQueryForVisualizationFn,
  getSchemaFn,
  onVisualize,
}: {
  query?: string;
  setQuery?: React.Dispatch<SetStateAction<string>>;
  runQueryFn: (
    connectionName: string,
    connectionId: number,
    query: string
  ) => any;
  runQueryForVisualizationFn?: (
    connectionName: string,
    connectionId: number,
    query: string
  ) => any;
  getSchemaFn: (connectionName: string, connectionId: number) => any;
  onVisualize?: (visualization: VisualizationData) => void;
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

  const visualizeData = tool({
    description: `Query data and visualize it as a chart. Use this tool when the user wants to see data visualized, analyze trends, compare values, or see distributions. 
The tool runs a SQL query and renders the results as a chart in the chat interface.
Choose the appropriate chart type:
- "bar": Best for comparing discrete categories or groups
- "line": Best for showing trends over time or continuous data
- "area": Best for showing cumulative totals or stacked comparisons over time  
- "pie": Best for showing proportions/percentages of a whole (use sparingly, only for <8 categories)

IMPORTANT: The query should return data suitable for visualization:
- Keep result sets reasonable (ideally <100 rows for best performance)
- Use GROUP BY, aggregations (COUNT, SUM, AVG) to summarize data
- Order results appropriately (e.g., by date for time series, by value for rankings)`,
    parameters: z.object({
      query: z.string().describe("The SQL query to run to get data for visualization"),
      connectionId: z
        .number()
        .describe("The connection ID from the database list"),
      connectionName: z
        .string()
        .describe("The connection name from the database list"),
      config: visualizationConfigSchema.describe("Configuration for how to visualize the data"),
    }),
    execute: async ({ query: sqlQuery, connectionId, connectionName, config }) => {
      try {
        // Use visualization-specific query function if available (higher row limit)
        const queryFn = runQueryForVisualizationFn ?? runQueryFn;
        const result = await queryFn(connectionName, connectionId, sqlQuery);
        
        if (result && "error" in result) {
          return JSON.stringify({ error: result.error });
        }

        // Handle both property naming conventions (records/totalCount from executeQuery, rows/rowCount from direct)
        const rows = result?.records ?? result?.rows ?? [];
        const totalCount = result?.totalCount ?? result?.rowCount ?? rows.length;

        // Validate that the specified columns exist in the result
        const columns = result?.columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
        
        if (!columns.includes(config.xAxis)) {
          return JSON.stringify({ 
            error: `Column "${config.xAxis}" not found in query results. Available columns: ${columns.join(", ")}` 
          });
        }

        const yAxes = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];
        for (const yCol of yAxes) {
          if (!columns.includes(yCol)) {
            return JSON.stringify({ 
              error: `Column "${yCol}" not found in query results. Available columns: ${columns.join(", ")}` 
            });
          }
        }

        const visualization: VisualizationData = {
          data: rows,
          config: config as VisualizationConfig,
          query: sqlQuery,
          totalRows: totalCount,
        };

        // Call the visualization callback if provided (for editor mode integration)
        if (onVisualize) {
          onVisualize(visualization);
        }

        return JSON.stringify({
          success: true,
          visualization,
          summary: `Visualized ${totalCount} rows as a ${config.chartType} chart showing ${config.title || `${yAxes.join(", ")} by ${config.xAxis}`}`,
        });
      } catch (error: any) {
        return JSON.stringify({ error: error.message || "Failed to visualize data" });
      }
    },
  });

  const askForPermission = tool({
    description: "Ask the user for permission to run destructive queries",
    parameters: z.object({
      query: z.string().describe("The query youd like to run"),
    }),
  });

  if (updateQuery && updateQuerySection) {
    return {
      updateQuery,
      updateQuerySection,
      runQuery,
      getSchema,
      visualizeData,
      askForPermission,
    };
  }

  return {
    runQuery,
    getSchema,
    visualizeData,
    askForPermission,
  };
}
