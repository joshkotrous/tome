import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Expand, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, AreaChart as AreaChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChartType = "bar" | "line" | "pie" | "area";

export interface VisualizationConfig {
  chartType: ChartType;
  xAxis: string;
  yAxis: string | string[];
  title?: string;
  description?: string;
}

export interface VisualizationData {
  data: Record<string, any>[];
  config: VisualizationConfig;
  query: string;
  totalRows: number;
}

// Color palette for charts
const COLORS = [
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#3b82f6", // blue-500
  "#84cc16", // lime-500
];

interface ChartProps {
  data: Record<string, any>[];
  config: VisualizationConfig;
  compact?: boolean;
}

function BarChartComponent({ data, config, compact }: ChartProps) {
  const yAxes = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={compact ? { top: 5, right: 5, left: -20, bottom: 5 } : { top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis 
          dataKey={config.xAxis} 
          tick={{ fill: "#a1a1aa", fontSize: compact ? 10 : 12 }}
          axisLine={{ stroke: "#3f3f46" }}
        />
        <YAxis 
          tick={{ fill: "#a1a1aa", fontSize: compact ? 10 : 12 }}
          axisLine={{ stroke: "#3f3f46" }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "#18181b", 
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            color: "#f4f4f5"
          }}
        />
        {!compact && <Legend />}
        {yAxes.map((key, index) => (
          <Bar 
            key={key} 
            dataKey={key} 
            fill={COLORS[index % COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartComponent({ data, config, compact }: ChartProps) {
  const yAxes = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={compact ? { top: 5, right: 5, left: -20, bottom: 5 } : { top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis 
          dataKey={config.xAxis} 
          tick={{ fill: "#a1a1aa", fontSize: compact ? 10 : 12 }}
          axisLine={{ stroke: "#3f3f46" }}
        />
        <YAxis 
          tick={{ fill: "#a1a1aa", fontSize: compact ? 10 : 12 }}
          axisLine={{ stroke: "#3f3f46" }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "#18181b", 
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            color: "#f4f4f5"
          }}
        />
        {!compact && <Legend />}
        {yAxes.map((key, index) => (
          <Line 
            key={key} 
            type="monotone" 
            dataKey={key} 
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 0, r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartComponent({ data, config, compact }: ChartProps) {
  const yAxes = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={compact ? { top: 5, right: 5, left: -20, bottom: 5 } : { top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis 
          dataKey={config.xAxis} 
          tick={{ fill: "#a1a1aa", fontSize: compact ? 10 : 12 }}
          axisLine={{ stroke: "#3f3f46" }}
        />
        <YAxis 
          tick={{ fill: "#a1a1aa", fontSize: compact ? 10 : 12 }}
          axisLine={{ stroke: "#3f3f46" }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "#18181b", 
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            color: "#f4f4f5"
          }}
        />
        {!compact && <Legend />}
        {yAxes.map((key, index) => (
          <Area 
            key={key} 
            type="monotone" 
            dataKey={key} 
            stroke={COLORS[index % COLORS.length]}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.3}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PieChartComponent({ data, config, compact }: ChartProps) {
  const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={!compact}
          label={compact ? false : ({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={compact ? 60 : 100}
          innerRadius={compact ? 30 : 50}
          fill="#8884d8"
          dataKey={yAxis}
          nameKey={config.xAxis}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "#18181b", 
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            color: "#f4f4f5"
          }}
        />
        {!compact && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartRenderer({ data, config, compact = false }: ChartProps) {
  switch (config.chartType) {
    case "bar":
      return <BarChartComponent data={data} config={config} compact={compact} />;
    case "line":
      return <LineChartComponent data={data} config={config} compact={compact} />;
    case "area":
      return <AreaChartComponent data={data} config={config} compact={compact} />;
    case "pie":
      return <PieChartComponent data={data} config={config} compact={compact} />;
    default:
      return <BarChartComponent data={data} config={config} compact={compact} />;
  }
}

function ChartTypeIcon({ type }: { type: ChartType }) {
  switch (type) {
    case "bar":
      return <BarChart3 className="size-3.5" />;
    case "line":
      return <LineChartIcon className="size-3.5" />;
    case "pie":
      return <PieChartIcon className="size-3.5" />;
    case "area":
      return <AreaChartIcon className="size-3.5" />;
    default:
      return <BarChart3 className="size-3.5" />;
  }
}

interface DataVisualizationProps {
  visualization: VisualizationData;
  className?: string;
}

export function DataVisualization({ visualization, className }: DataVisualizationProps) {
  const [chartType, setChartType] = useState<ChartType>(visualization.config.chartType);
  const [isExpanded, setIsExpanded] = useState(false);

  const currentConfig = { ...visualization.config, chartType };

  const chartTypes: ChartType[] = ["bar", "line", "area", "pie"];

  return (
    <div className={cn("border rounded-lg bg-zinc-900/75 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <ChartTypeIcon type={chartType} />
          <span className="text-xs font-medium text-zinc-300">
            {visualization.config.title || "Data Visualization"}
          </span>
          <span className="text-xs text-zinc-500">
            ({visualization.totalRows} rows)
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Chart type switcher */}
          <div className="flex items-center gap-0.5 mr-2">
            {chartTypes.map((type) => (
              <Button
                key={type}
                size="xs"
                variant={chartType === type ? "secondary" : "ghost"}
                className="!p-1 h-fit"
                onClick={() => setChartType(type)}
              >
                <ChartTypeIcon type={type} />
              </Button>
            ))}
          </div>
          {/* Expand button */}
          <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
            <DialogTrigger asChild>
              <Button size="xs" variant="ghost" className="!p-1 h-fit">
                <Expand className="size-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh]">
              <DialogTitle className="flex items-center gap-2">
                <ChartTypeIcon type={chartType} />
                {visualization.config.title || "Data Visualization"}
                <span className="text-sm font-normal text-zinc-500">
                  ({visualization.totalRows} rows)
                </span>
              </DialogTitle>
              <div className="flex-1 min-h-0">
                {/* Chart type switcher in expanded view */}
                <div className="flex items-center gap-1 mb-4">
                  {chartTypes.map((type) => (
                    <Button
                      key={type}
                      size="xs"
                      variant={chartType === type ? "secondary" : "ghost"}
                      className="gap-1.5"
                      onClick={() => setChartType(type)}
                    >
                      <ChartTypeIcon type={type} />
                      <span className="capitalize">{type}</span>
                    </Button>
                  ))}
                </div>
                {/* Full size chart */}
                <div className="h-[calc(100%-60px)]">
                  <ChartRenderer 
                    data={visualization.data} 
                    config={currentConfig} 
                    compact={false} 
                  />
                </div>
              </div>
              {/* Query preview */}
              {visualization.query && (
                <div className="mt-4 p-2 bg-zinc-950 rounded border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Query:</div>
                  <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                    {visualization.query}
                  </pre>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Compact chart */}
      <div className="h-48 p-2">
        <ChartRenderer 
          data={visualization.data} 
          config={currentConfig} 
          compact={true} 
        />
      </div>

      {/* Description */}
      {visualization.config.description && (
        <div className="px-2 pb-2 text-xs text-zinc-400">
          {visualization.config.description}
        </div>
      )}
    </div>
  );
}

export function VisualizationLoading() {
  return (
    <div className="border rounded-lg bg-zinc-900/75 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <BarChart3 className="size-4 animate-pulse" />
        <span>Generating visualization...</span>
      </div>
      <div className="h-40 flex items-center justify-center">
        <div className="w-full h-full bg-zinc-800/50 rounded animate-pulse" />
      </div>
    </div>
  );
}
