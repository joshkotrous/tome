import {
  ArrowUp,
  BarChart3,
  Check,
  ChevronRight,
  Database,
  FileCode,
  MessageCircle,
  MessageCirclePlus,
  Plus,
  SidebarClose,
  Trash,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { cn, displayDate } from "@/lib/utils";
import Spinner from "./ui/spinner";
import MarkdownRenderer, { TomeSyntaxHighlighter } from "./markdownRederer";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import ResizableContainer from "./ui/resizableContainer";
import { Conversation, TomeMessage } from "@/types";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import AnimatedEllipsis from "./animatedEllipsis";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";
import { useAppData } from "@/applicationDataProvider";
import { TomeAgentModel, TomeAgentModels, getLocalModels } from "../../core/ai";
import { useQueryData } from "@/queryDataProvider";
import { AIProviderLogo } from "./toolbar";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileUIPart,
  ReasoningUIPart,
  SourceUIPart,
  StepStartUIPart,
  TextUIPart,
  ToolInvocationUIPart,
} from "@ai-sdk/ui-utils";
import { Text } from "./ui/text";
import { AnimateEllipse } from "./animatedEllipse";
import { useAgent } from "@/agent/useAgent";
import { useConversationData } from "@/conversationDataProvider";
import {
  DataVisualization,
  VisualizationData,
  VisualizationLoading,
} from "./dataVisualization";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolName: string | null;
};

export default function ChatInterface() {
  const { settings } = useAppData();

  const {
    conversations,
    selectedConversation,
    setSelectedConversation,
    currentMessages,
    refreshConversations,
  } = useConversationData();

  const [model, setModel] = useState<TomeAgentModel>({
    provider: "Open AI",
    name: "gpt-4o",
  });

  useEffect(() => {
    setModel(
      settings?.aiFeatures.providers.openai.enabled
        ? { provider: "Open AI", name: "gpt-4o" }
        : { provider: "Anthropic", name: "claude-sonnet-4" },
    );
  }, [settings]);

  const [input, setInput] = useState("");

  const { messages, thinking, sendMessage, permissionNeeded, approveQuery } =
    useAgent({
      initialMessages: currentMessages,
      model,
      mode: "agent",
      selectedConversation,
    });

  async function send(msg: string) {
    setInput("");
    if (!selectedConversation) {
      const convo = await window.conversations.createConversation(msg);
      refreshConversations();
      setSelectedConversation(convo);
      await sendMessage(msg, convo.id);
      return;
    }
    await sendMessage(msg);
  }

  const suggestions = [
    {
      name: "Run query",
      message: "Run a query of your choice against any table or database",
    },
    {
      name: "Visualize Data",
      message: "Run a query of your choice against any table or database",
    },
    {
      name: "Analyze Data",
      message: "Run a query of your choice against any table or database",
    },
    {
      name: "Ask a question",
      message:
        "Come up with a question I could ask you about my data and follow with an answer",
    },
  ];

  return (
    <div className="flex flex-1 h-full">
      <ConversationsList
        refreshConversations={refreshConversations}
        conversations={conversations}
        selectedConversation={selectedConversation}
        setSelectedConversation={setSelectedConversation}
      />
      {selectedConversation && messages.length > 0 && (
        <ChatInputDisplay
          refreshResponse={approveQuery}
          permissionNeeded={permissionNeeded}
          showQueryControls={false}
          messages={messages}
          thinking={thinking}
          input={input}
          setInput={setInput}
          model={model}
          setModel={setModel}
          sendMessage={send}
        />
      )}
      {!selectedConversation && (
        <div className="flex  flex-col flex-1 w-full  px-8 items-center justify-center">
          <h2 className="text-center font-bold text-2xl  select-none">
            What can I help you with today?
          </h2>
          <div className="flex justify-center flex-wrap py-2 gap-1.5 ">
            {suggestions.map((i) => (
              <div
                key={i.name}
                onClick={() => send(i.message)}
                className="text-xs px-2 p-1 border rounded-full bg-zinc-900 hover:bg-zinc-800 select-none transition-all"
              >
                {i.name}
              </div>
            ))}
          </div>
          {thinking && (
            <div className="flex gap-1.5 items-center">
              <Spinner /> Thinking...
            </div>
          )}
          <ChatInput
            model={model}
            onModelChange={setModel}
            input={input}
            setInput={setInput}
            onSubmit={() => send(input)}
          />
        </div>
      )}
    </div>
  );
}

export function ChatInputDisplay({
  permissionNeeded,
  setModel,
  model,
  input,
  setInput,
  thinking,
  messages,
  sendMessage,
  showQueryControls = true,
  refreshResponse,
}: {
  permissionNeeded?: boolean;
  refreshResponse?: () => Promise<void>;
  messages: TomeMessage[];
  thinking: boolean;
  setModel: React.Dispatch<SetStateAction<TomeAgentModel>>;
  model: TomeAgentModel;
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
  sendMessage: (val: string) => Promise<void>;
  showQueryControls: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  useEffect(() => {
    if (scrollContainerRef.current && messages.length > 0) {
      const totalSize = virtualizer.getTotalSize();
      scrollContainerRef.current.scrollTo({
        top: totalSize,
        behavior: "smooth",
      });
    }
  }, [thinking, messages, virtualizer]);
  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-col flex-1 h-full overflow-auto mx-auto w-full max-w-5xl"
    >
      <div className="flex flex-col flex-1 p-4 pb-6 gap-2">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={cn(
                    "flex py-1",
                    message.role === "user" && "justify-end",
                  )}
                >
                  <ChatMessage sendMessage={sendMessage} message={message} />
                </div>
              </div>
            );
          })}
        </div>
        {thinking && <AnimatedEllipsis size="lg" />}
      </div>
      <div className=" flex flex-col gap-2 sticky justify-center items-center w-full bottom-0 left-0 px-4">
        <div className="relative max-w-2xl w-full h-fit py-4">
          <div className="px-4 w-full left-0">
            <AnimatePresence>
              {(thinking || permissionNeeded) && (
                <motion.div
                  initial={{ y: 40 }}
                  animate={{ y: 0 }}
                  exit={{ y: 40 }}
                  transition={{ duration: 0.1 }}
                  className="bg-zinc-900  w-full rounded-t-md border border-b-0 text-xs p-2 flex items-center justify-between"
                >
                  {thinking && <Thinking />}
                  {permissionNeeded && (
                    <ApproveQueryButton refreshResponse={refreshResponse} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ChatInput
            showQueryControls={showQueryControls}
            thinking={thinking}
            model={model}
            onModelChange={setModel}
            input={input}
            setInput={setInput}
            onSubmit={() => sendMessage(input)}
          />
        </div>
      </div>
    </div>
  );
}

function ApproveQueryButton({
  refreshResponse,
}: {
  refreshResponse?: () => Promise<void>;
}) {
  useEffect(() => {
    const handleKeyDown = (event: any) => {
      // Check for Cmd+Shift+Enter (Mac) or Ctrl+Shift+Enter (Windows/Linux)
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        if (refreshResponse) {
          refreshResponse();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [refreshResponse]);

  return (
    <div className="w-full flex items-center justify-between">
      <span>
        Permission required to continue
        <AnimateEllipse speed={300} />
      </span>
      <Button
        onClick={() => {
          if (refreshResponse) {
            refreshResponse();
          }
        }}
        size="xs"
        className="bg-green-500/25 border-green-400 text-green-400 hover:bg-green-500/50 transition-all !p-1 !px-2 !h-fit !text-[10px]"
      >
        Run Query ⌘⇧↵
      </Button>
    </div>
  );
}

export function DatabaseSwitcher() {
  const { connections, currentConnection, setCurrentConnection } =
    useQueryData();

  return (
    <Tooltip delayDuration={700}>
      <Select
        value={currentConnection?.id?.toString()}
        onValueChange={(value) => {
          const selectedConnection = connections.find(
            (c) => c.id.toString() === value,
          );
          if (selectedConnection) {
            setCurrentConnection(selectedConnection);
          }
        }}
      >
        <TooltipTrigger asChild>
          <div className="shrink-0">
            <SelectTrigger className="!h-fit !p-1 gap-1.5 !text-white text-xs !bg-zinc-900 max-w-32">
              <Database className="size-3 shrink-0" />
              <span className="truncate">{currentConnection?.name}</span>
            </SelectTrigger>
          </div>
        </TooltipTrigger>

        <SelectContent className="">
          {connections.map((connection) => (
            <SelectItem key={connection.id} value={connection.id.toString()}>
              {connection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <TooltipContent>Switch database</TooltipContent>
    </Tooltip>
  );
}

export function QuerySwitcher() {
  const {
    queries,
    currentQuery,
    setCurrentQuery,
    currentConnection,
    createQuery,
  } = useQueryData();
  if (!currentQuery) return null;
  return (
    <Tooltip delayDuration={700}>
      <Select
        value={currentQuery?.id?.toString()}
        onValueChange={(value) => {
          if (value === "new") {
            if (!currentConnection) return;
            createQuery({
              connection: currentConnection?.id,
              createdAt: new Date(),
              query: "",
              title: "untitled",
            });
          }
          const selectedQuery = queries.find((q) => q.id.toString() === value);
          if (selectedQuery) {
            setCurrentQuery(selectedQuery);
          }
        }}
      >
        <TooltipTrigger asChild>
          <div className="shrink-0">
            <SelectTrigger className="!h-fit !p-1 gap-1.5 !text-white text-xs !bg-zinc-900 max-w-32">
              <FileCode className="size-3 shrink-0" />
              <span className="truncate">{currentQuery?.title}</span>
            </SelectTrigger>
          </div>
        </TooltipTrigger>

        <SelectContent className="">
          {queries.map((query) => (
            <SelectItem key={query.id} value={query.id.toString()}>
              {query.title}
            </SelectItem>
          ))}
          <SelectItem value="new">
            <Plus /> New query
          </SelectItem>
        </SelectContent>
      </Select>
      <TooltipContent>Switch query</TooltipContent>
    </Tooltip>
  );
}

export function Thinking({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-1.5 items-center text-xs", className)}>
      <Spinner className="size-3" /> Thinking...
    </div>
  );
}

function ConversationsList({
  conversations,
  selectedConversation,
  setSelectedConversation,
  refreshConversations,
}: {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  refreshConversations: () => void;
  setSelectedConversation: React.Dispatch<SetStateAction<Conversation | null>>;
}) {
  const [open, setOpen] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when conversations change and we're adding to the beginning
  useEffect(() => {
    if (scrollContainerRef.current && conversations.length > 0) {
      // If the first conversation is very recent (within last 5 seconds), scroll to top
      const firstConversation = conversations[0];
      const now = new Date();
      const conversationAge =
        now.getTime() - new Date(firstConversation.createdAt).getTime();

      if (conversationAge < 5000) {
        // 5 seconds
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [conversations.length]);

  function handleOpen() {
    setOpen((open) => !open);
  }

  return (
    <ResizableContainer
      direction="horizontal"
      defaultSize={250}
      minSize={60}
      maxSize={500}
      snapThreshold={60}
      isCollapsed={!open}
      onCollapsedChange={(collapsed) => setOpen(!collapsed)}
      className="bg-zinc-900/50 border border-zinc-800 h-full rounded-r-md flex flex-col"
      collapsedSize={40}
    >
      {/* Header - Fixed */}
      <div className="flex gap-1.5 items-center p-1.5 border-b text-sm h-8 flex-shrink-0">
        {open && (
          <>
            <MessageCircle className="size-5 text-zinc-400 fill-zinc-400" />{" "}
            Conversations
          </>
        )}
      </div>

      {/* Toggle Button - Fixed */}
      <div className="absolute top-0.5 right-1 z-10">
        <Button
          onClick={handleOpen}
          size="xs"
          variant="ghost"
          className="w-fit has-[>svg]:px-1"
        >
          <SidebarClose className="text-zinc-500 size-5" />
        </Button>
      </div>

      {/* Controls - Fixed */}
      <div className="p-2 space-y-2 flex-shrink-0">
        <Button
          onClick={() => setSelectedConversation(null)}
          className="w-full overflow-hidden"
        >
          <MessageCirclePlus /> {open && "New Chat"}
        </Button>
        {open && <Input placeholder="Search..." />}
      </div>

      {/* Scrollable Content - Add ref here */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-2 min-h-0"
      >
        {open && !selectedConversation && (
          <div
            className={cn(
              "rounded-sm p-1 gap-4 px-4 pr-1 items-center text-sm text-nowrap whitespace-nowrap overflow-hidden hover:bg-zinc-800 select-none transition-all flex bg-zinc-800 text-white flex-shrink-0",
            )}
          >
            New conversation
          </div>
        )}
        {open &&
          conversations.map((i) => (
            <ConversationListItem
              key={i.id}
              conversation={i}
              refreshConversations={refreshConversations}
              selectedConversation={selectedConversation}
              setSelectedConversation={setSelectedConversation}
            />
          ))}
      </div>
    </ResizableContainer>
  );
}

function ConversationListItem({
  selectedConversation,
  setSelectedConversation,
  conversation,
  refreshConversations,
}: {
  selectedConversation: Conversation | null;
  setSelectedConversation: React.Dispatch<SetStateAction<Conversation | null>>;
  conversation: Conversation;
  refreshConversations: () => void;
}) {
  const [name, setName] = useState(conversation.name);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const pollForName = async () => {
      try {
        const updatedConversation = await window.conversations.getConversation(
          conversation.id,
        );

        if (!isCancelled && updatedConversation?.name) {
          setName(updatedConversation.name);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (error) {
        console.error("Error polling for conversation name:", error);
      }
    };

    // If name is not present, start polling
    if (!conversation.name) {
      // Try immediately first
      pollForName();

      // Then poll every 2 seconds until name is found
      intervalId = setInterval(pollForName, 2000);
    }

    // Cleanup function
    return () => {
      isCancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [conversation.id, conversation.name]);

  return (
    <div
      key={conversation.id}
      onClick={() => setSelectedConversation(conversation)}
      className={cn(
        "rounded-sm text-zinc-400 p-1 gap-2 px-4 pr-1 items-center text-sm hover:bg-zinc-800 select-none transition-all flex flex-shrink-0",
        selectedConversation?.id === conversation.id &&
          "bg-zinc-800 text-white",
      )}
    >
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
        {name || <Text variant="shine">Generating...</Text>}
      </span>
      <span className="text-xs flex-shrink-0">
        {displayDate(conversation.createdAt)}
      </span>
      <div className="flex-shrink-0">
        <DeleteConversation
          onComplete={() => refreshConversations()}
          conversation={conversation}
        />
      </div>
    </div>
  );
}

function DeleteConversation({
  conversation,
  onComplete,
}: {
  conversation: Conversation;
  onComplete?: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger>
        <Trash className="size-3.5 hover:text-red-500 transition-all" />
      </DialogTrigger>
      <DialogContent className="">
        <DialogTitle>Delete conversation?</DialogTitle>
        <DialogDescription>
          This conversation and all its associated data will be removed
        </DialogDescription>
        <div className="w-full flex justify-end gap-2">
          <DialogClose>
            <Button>Cancel</Button>
          </DialogClose>
          <DialogClose>
            <Button
              onClick={async () => {
                await window.conversations.deleteConversation(conversation.id);
                if (onComplete) {
                  onComplete();
                }
              }}
              variant="destructive"
            >
              Delete
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatInput({
  input,
  setInput,
  onSubmit,
  model,
  onModelChange,
  showQueryControls,
}: {
  model: TomeAgentModel;
  onModelChange: React.Dispatch<SetStateAction<TomeAgentModel>>;
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
  thinking?: boolean;
  showQueryControls?: boolean;
}) {
  const handleSubmit = () => {
    if (input.trim()) {
      // Only submit if there's actual content
      onSubmit();
    }
  };

  return (
    <div className="bg-zinc-900 rounded-md border p-2 flex flex-col gap-2 w-full max-w-2xl relative z-50">
      {/* Top controls row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <ModelPicker model={model} onModelChange={onModelChange} />
        {showQueryControls && (
          <>
            <QuerySwitcher />
            <DatabaseSwitcher />
          </>
        )}
      </div>

      {/* Input and send button row */}
      <div className="flex items-end gap-2">
        <Textarea
          placeholder="Enter a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-medium border-none bg-zinc-900 dark:bg-input/0 h-20 text-sm flex-1"
          onKeyDown={(e) => {
            // Enter sends message, Shift+Enter creates new line
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Tooltip delayDuration={1000}>
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={handleSubmit}
                variant="outline"
                className="size-9 rounded-lg bg-gradient-to-b from-zinc-700/50 to-zinc-800/50 border-zinc-600 hover:from-zinc-600/50 hover:to-zinc-700/50 hover:border-zinc-500 transition-all"
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>Enter to send</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ModelPicker({
  model,
  onModelChange,
}: {
  model: TomeAgentModel;
  onModelChange: React.Dispatch<SetStateAction<TomeAgentModel>>;
}) {
  const { settings } = useAppData();

  // Get available models based on enabled providers
  const getAvailableModels = () => {
    if (!settings) return [];

    const { openai, anthropic } = settings.aiFeatures.providers;
    const localModel = settings.aiFeatures.localModel;

    let models: TomeAgentModel[] = [];

    // Add OpenAI models if enabled
    if (openai.enabled) {
      models = [
        ...models,
        ...TomeAgentModels.filter((model) => model.provider === "Open AI"),
      ];
    }

    // Add Anthropic models if enabled
    if (anthropic.enabled) {
      models = [
        ...models,
        ...TomeAgentModels.filter((model) => model.provider === "Anthropic"),
      ];
    }

    // Add local models if configured
    if (localModel?.url && localModel.models.length > 0) {
      models = [...models, ...getLocalModels(localModel)];
    }

    return models;
  };

  const availableModels = getAvailableModels();

  // Check if the current model is still available
  const isCurrentModelAvailable = availableModels.some(
    (availableModel) => availableModel.name === model.name,
  );

  // Group models by provider for better organization when both providers are enabled
  const groupedModels = useMemo(() => {
    if (availableModels.length === 0) return {};

    return availableModels.reduce(
      (groups, model) => {
        const provider = model.provider;
        if (!groups[provider]) {
          groups[provider] = [];
        }
        groups[provider].push(model);
        return groups;
      },
      {} as Record<string, TomeAgentModel[]>,
    );
  }, [availableModels]);

  // If current model is not available, auto-select the first available model
  useEffect(() => {
    if (!isCurrentModelAvailable && availableModels.length > 0) {
      onModelChange(availableModels[0]);
    }
  }, [isCurrentModelAvailable, availableModels, onModelChange]);

  // Early returns after all hooks have been called
  if (!settings) return null;

  // If no models are available, show a disabled state
  if (availableModels.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="border !bg-zinc-950/40 !h-fit !p-1 !px-2 text-xs opacity-50">
          No models available
        </SelectTrigger>
      </Select>
    );
  }

  const shouldGroupByProvider = Object.keys(groupedModels).length > 1;

  return (
    <Select
      value={model.name}
      onValueChange={(val: string) => {
        // First check static models, then check available models (which includes local)
        const selectedModel =
          TomeAgentModels.find((i) => i.name === val) ??
          availableModels.find((i) => i.name === val);
        if (selectedModel) {
          onModelChange(selectedModel);
        }
      }}
    >
      <SelectTrigger className="border !bg-zinc-950/40 !h-fit !p-1 !px-2 text-xs shrink-0 max-w-40">
        <AIProviderLogo
          className="size-3.5 shrink-0"
          provider={model.provider}
        />
        <span className="truncate">{model.name}</span>
      </SelectTrigger>
      <SelectContent className="">
        {shouldGroupByProvider
          ? // Group models by provider when both are available
            Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider}>
                <div className="px-2 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/50">
                  {provider}
                </div>
                {models.map((model) => (
                  <SelectItem key={model.name} value={model.name}>
                    <div className="flex items-center gap-2">
                      <AIProviderLogo
                        className="size-3"
                        provider={model.provider}
                      />
                      {model.name}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))
          : // Show flat list when only one provider is enabled
            availableModels.map((model) => (
              <SelectItem key={model.name} value={model.name}>
                <div className="flex items-center gap-2">
                  <AIProviderLogo
                    className="size-3"
                    provider={model.provider}
                  />
                  {model.name}
                </div>
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  );
}

interface ToolDisplayResult {
  text: React.ReactNode;
  visualization?: VisualizationData;
  query?: string;
  queryResult?: { records: any[]; totalCount: number; error?: string };
}

function toolDisplay(
  part:
    | TextUIPart
    | ReasoningUIPart
    | ToolInvocationUIPart
    | SourceUIPart
    | FileUIPart
    | StepStartUIPart,
): ToolDisplayResult | undefined {
  if (part.type !== "tool-invocation") {
    return;
  }

  const { state, toolName, args } = part.toolInvocation;
  const result =
    "result" in part.toolInvocation ? part.toolInvocation.result : undefined;

  if (toolName === "getSchema") {
    if (state === "partial-call") {
      return {
        text: (
          <Text className="text-xs" variant="shine">
            Getting schema...
          </Text>
        ),
      };
    }
    return { text: "Retrieved schema" };
  }

  if (toolName === "updateQuery") {
    if (state === "partial-call") {
      return {
        text: (
          <Text className="text-xs" variant="shine">
            Updating query...
          </Text>
        ),
      };
    }
    return { text: "Updated query" };
  }

  if (toolName === "runQuery") {
    const queryStr = args?.query as string | undefined;

    if (state === "partial-call") {
      return {
        text: (
          <Text className="text-xs" variant="shine">
            Running query...
          </Text>
        ),
        query: queryStr,
      };
    }

    // Parse the result
    let queryResult:
      | { records: any[]; totalCount: number; error?: string }
      | undefined;
    if (result) {
      try {
        const resultStr =
          typeof result === "string" ? result : JSON.stringify(result);
        const parsed = JSON.parse(resultStr);
        if (parsed.error) {
          queryResult = { records: [], totalCount: 0, error: parsed.error };
        } else {
          queryResult = {
            records: parsed.records ?? parsed.rows ?? [],
            totalCount: parsed.totalCount ?? parsed.rowCount ?? 0,
          };
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    return {
      text: "Ran query",
      query: queryStr,
      queryResult,
    };
  }

  if (toolName === "visualizeData") {
    const queryStr = args?.query as string | undefined;

    if (state === "partial-call") {
      return {
        text: (
          <Text className="text-xs" variant="shine">
            <BarChart3 className="size-3 inline mr-1" />
            Generating visualization...
          </Text>
        ),
        query: queryStr,
      };
    }

    // Parse the result to extract visualization data
    if (state === "result" && result) {
      try {
        const resultStr =
          typeof result === "string" ? result : JSON.stringify(result);
        const parsed = JSON.parse(resultStr);

        if (parsed.error) {
          return {
            text: `Visualization error: ${parsed.error}`,
            query: queryStr,
          };
        }

        if (parsed.visualization) {
          return {
            text: (
              <span className="flex items-center gap-1.5">
                <BarChart3 className="size-3" />
                Data visualized
              </span>
            ),
            visualization: parsed.visualization as VisualizationData,
            query: queryStr,
            queryResult: {
              records: parsed.visualization.data ?? [],
              totalCount: parsed.visualization.totalRows ?? 0,
            },
          };
        }
      } catch (e) {
        return { text: "Visualization created", query: queryStr };
      }
    }
    return { text: "Visualization created", query: queryStr };
  }

  if (toolName === "askForPermission") {
    if (state === "partial-call") {
      return { text: "Awaiting permission to continue..." };
    }
    return { text: "Permission received" };
  }
}

function ToolResultAccordion({
  toolName,
  display,
  toolInvocation,
  messageMetadata,
}: {
  toolName: string;
  display: ToolDisplayResult | undefined;
  toolInvocation: any;
  messageMetadata?: TomeMessage["metadata"];
}) {
  const [queryOpen, setQueryOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const isLoading = toolInvocation.state === "partial-call";
  const isVisualization = toolName === "visualizeData";
  const isRunQuery = toolName === "runQuery";
  const isAskPermission = toolName === "askForPermission";

  // Use metadata as fallback for persisted messages
  const queryFromMetadata = messageMetadata?.queryResults?.query;
  const resultsFromMetadata = messageMetadata?.queryResults;

  const hasQuery =
    display?.query || toolInvocation.args?.query || queryFromMetadata;
  const queryResults =
    display?.queryResult ||
    (resultsFromMetadata
      ? {
          records: resultsFromMetadata.records,
          totalCount: resultsFromMetadata.totalCount,
        }
      : undefined);
  const hasResults = queryResults && !queryResults.error;
  const hasError = display?.queryResult?.error;

  return (
    <div className="my-1">
      {/* Tool status indicator */}
      <div className="border p-2 rounded-sm bg-zinc-900/75 w-fit min-w-64">
        <div className="flex gap-1.5 items-center text-xs text-zinc-400">
          {isLoading && (isAskPermission || isRunQuery || isVisualization) && (
            <Spinner className="size-3.5" />
          )}
          {toolInvocation.state === "result" && !hasError && (
            <Check className="size-3.5 text-green-500" />
          )}
          {hasError && <span className="text-red-500">✕</span>}
          {display?.text}
        </div>

        {/* Query accordion - for runQuery, visualizeData, and askForPermission */}
        {hasQuery && (
          <div className="mt-2 space-y-1">
            <div
              onClick={() => setQueryOpen((prev) => !prev)}
              className="flex items-center gap-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer select-none"
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform",
                  queryOpen && "rotate-90",
                )}
              />
              View Query
            </div>
            {queryOpen && (
              <div className="max-w-md overflow-auto">
                <TomeSyntaxHighlighter
                  content={
                    display?.query ||
                    toolInvocation.args?.query ||
                    queryFromMetadata ||
                    ""
                  }
                  language="sql"
                  showLineNumbers={false}
                />
              </div>
            )}
          </div>
        )}

        {/* Results accordion - for runQuery and visualizeData */}
        {(isRunQuery || isVisualization) && !isLoading && (
          <div className="mt-1 space-y-1">
            {hasError ? (
              <div className="text-xs text-red-400 mt-1">
                Error: {display?.queryResult?.error}
              </div>
            ) : hasResults ? (
              <>
                <div
                  onClick={() => setResultsOpen((prev) => !prev)}
                  className="flex items-center gap-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer select-none"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-transform",
                      resultsOpen && "rotate-90",
                    )}
                  />
                  View Results ({queryResults?.totalCount} rows)
                </div>
                {resultsOpen && queryResults && (
                  <div className="max-w-md max-h-48 overflow-auto border rounded bg-zinc-950/50 mt-1">
                    <QueryResultPreview records={queryResults.records} />
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Visualization loading state */}
      {isVisualization && isLoading && (
        <div className="mt-2 w-80">
          <VisualizationLoading />
        </div>
      )}

      {/* Rendered visualization */}
      {isVisualization && display?.visualization && (
        <div className="mt-2 w-96">
          <DataVisualization visualization={display.visualization} />
        </div>
      )}
    </div>
  );
}

function QueryResultPreview({ records }: { records: any[] }) {
  if (!records || records.length === 0) {
    return <div className="p-2 text-xs text-zinc-500">No results</div>;
  }

  const columns = Object.keys(records[0]);
  const displayRecords = records.slice(0, 10); // Show max 10 rows in preview

  return (
    <table className="w-full text-xs">
      <thead className="bg-zinc-900 sticky top-0">
        <tr>
          {columns.map((col) => (
            <th
              key={col}
              className="px-2 py-1 text-left text-zinc-400 font-medium border-b border-zinc-800"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayRecords.map((row, i) => (
          <tr
            key={i}
            className="border-b border-zinc-800/50 hover:bg-zinc-900/50"
          >
            {columns.map((col) => (
              <td
                key={col}
                className="px-2 py-1 text-zinc-300 truncate max-w-32"
              >
                {row[col] === null ? (
                  <span className="text-zinc-500">null</span>
                ) : (
                  String(row[col])
                )}
              </td>
            ))}
          </tr>
        ))}
        {records.length > 10 && (
          <tr>
            <td
              colSpan={columns.length}
              className="px-2 py-1 text-zinc-500 text-center"
            >
              ... and {records.length - 10} more rows
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ChatMessage({
  message,
}: {
  message: Omit<TomeMessage, "id">;
  sendMessage: (v: string) => void;
}) {
  const fromUser = message.role === "user";

  // Extract visualizations from tool invocations
  const toolParts = message.parts.filter((i) => i.type === "tool-invocation");

  return (
    <div
      className={cn(
        "overflow-auto max-w-xl",
        fromUser ? "items-end py-4" : "items-start",
      )}
    >
      {message.role === "assistant" &&
        toolParts.map((k, index) => {
          if (k.type !== "tool-invocation") return null;

          const display = toolDisplay(k);

          return (
            <ToolResultAccordion
              key={index}
              toolName={k.toolInvocation.toolName}
              display={display}
              toolInvocation={k.toolInvocation}
              messageMetadata={message.metadata}
            />
          );
        })}

      {message.content.trim() !== "" && (
        <>
          <span
            className={cn(
              "pb-2 w-full flex text-xs text-zinc-400 capitalize",
              fromUser && "justify-end ",
            )}
          >
            {message.role}
          </span>
          <div
            className={cn(
              " px-4 py-3 whitespace-pre-wrap break-words",
              fromUser
                ? "border-r-2 border-r-zinc-600 text-white"
                : "border-l-2 border-l-zinc-700 text-zinc-100",
            )}
          >
            <MarkdownRenderer content={message.content} />
          </div>
        </>
      )}
    </div>
  );
}
