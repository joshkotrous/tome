import {
  ArrowUp,
  Check,
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
import { useAgent } from "@/useAgent";
import Spinner from "./ui/spinner";
import MarkdownRenderer from "./markdownRederer";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import ResizableContainer from "./ui/resizableContainer";
import { Conversation, ConversationMessage } from "@/types";
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
import { TomeAgentModel, TomeAgentModels } from "../../core/ai";
import { useQueryData } from "@/queryDataProvider";
import { AIProviderLogo } from "./toolbar";
import { useVirtualizer } from "@tanstack/react-virtual";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface() {
  const { settings } = useAppData();

  const [model, setModel] = useState<TomeAgentModel>({
    provider: "Open AI",
    name: "gpt-4o",
  });

  useEffect(() => {
    setModel(
      settings?.aiFeatures.providers.openai.enabled
        ? { provider: "Open AI", name: "gpt-4o" }
        : { provider: "Anthropic", name: "claude-sonnet-4" }
    );
  }, [settings]);

  const [selectedConversation, setSelectedConversation] = useState<
    number | null
  >(null);
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const { msgs, send, thinking } = useAgent({
    messages,
    setMessages,
  });
  async function sendMessage(msg: ChatMessage) {
    let convo: number | null = selectedConversation;
    if (!selectedConversation) {
      const newConversation = await window.conversations.createConversation(
        msg.content
      );
      convo = newConversation.id;
      setSelectedConversation(newConversation.id);
    }
    send(msg.content, model, convo);
    setInput("");
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

  useEffect(() => {
    async function getData() {
      if (selectedConversation) {
        const convo = await window.messages.listMessages(selectedConversation);
        setMessages(convo);
      } else {
        setMessages([]);
      }
    }
    getData();
  }, [selectedConversation]);

  return (
    <div className="flex flex-1 h-full">
      <ConversationsList
        selectedConversation={selectedConversation}
        setSelectedConversation={setSelectedConversation}
      />
      {selectedConversation && messages.length > 0 && (
        <ChatInputDisplay
          showQueryControls={false}
          messages={msgs}
          thinking={thinking}
          input={input}
          setInput={setInput}
          model={model}
          setModel={setModel}
          sendMessage={sendMessage}
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
                onClick={() =>
                  sendMessage({ role: "user", content: i.message })
                }
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
            onSubmit={() => sendMessage({ role: "user", content: input })}
          />
        </div>
      )}
    </div>
  );
}

export function ChatInputDisplay({
  setModel,
  model,
  input,
  setInput,
  thinking,
  messages,
  sendMessage,
  showQueryControls = true,
}: {
  messages: ConversationMessage[];
  thinking: boolean;
  setModel: React.Dispatch<SetStateAction<TomeAgentModel>>;
  model: TomeAgentModel;
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
  sendMessage: (val: ChatMessage) => Promise<void>;
  showQueryControls: boolean;
}) {
  const { currentConnection, currentQuery } = useQueryData();
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
                    message.role === "user" && "justify-end"
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
        <div className="max-w-2xl w-full h-fit py-4">
          <div className="w-full flex gap-1.5">
            {showQueryControls && (
              <div className="flex gap-1.5 p-2 pb-4 relative top-2 z-30 bg-zinc-800/40 backdrop-blur-lg rounded-t-md">
                {currentQuery && <QuerySwitcher />}
                {currentConnection && <DatabaseSwitcher />}
              </div>
            )}
          </div>
          <ChatInput
            thinking={thinking}
            model={model}
            onModelChange={setModel}
            input={input}
            setInput={setInput}
            onSubmit={() => sendMessage({ role: "user", content: input })}
          />
        </div>
      </div>
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
            (c) => c.id.toString() === value
          );
          if (selectedConnection) {
            setCurrentConnection(selectedConnection);
          }
        }}
      >
        <TooltipTrigger>
          <SelectTrigger className="!h-fit !p-1 gap-1.5 !text-white text-xs !bg-zinc-900">
            <Database className="size-3" />
            {currentConnection?.name}
          </SelectTrigger>
        </TooltipTrigger>

        <SelectContent className="dark">
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
        <TooltipTrigger>
          <SelectTrigger className="!h-fit !p-1 gap-1.5 !text-white text-xs !bg-zinc-900">
            <FileCode className="size-3" />
            {currentQuery?.title}
          </SelectTrigger>
        </TooltipTrigger>

        <SelectContent className="dark">
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
  selectedConversation,
  setSelectedConversation,
}: {
  selectedConversation: number | null;
  setSelectedConversation: React.Dispatch<SetStateAction<number | null>>;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [open, setOpen] = useState(true);

  function handleOpen() {
    setOpen((open) => !open);
  }

  async function getData() {
    const convos = await window.conversations.listConversations();
    setConversations(convos);
  }

  useEffect(() => {
    getData();
  }, []);

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

      {/* Scrollable Content - This is the key fix */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-2 min-h-0">
        {open && !selectedConversation && (
          <div
            className={cn(
              "rounded-sm p-1 gap-4 px-4 pr-1 items-center text-sm text-nowrap whitespace-nowrap overflow-hidden hover:bg-zinc-800 select-none transition-all flex bg-zinc-800 text-white flex-shrink-0"
            )}
          >
            New conversation
          </div>
        )}
        {open &&
          conversations.map((i) => (
            <div
              key={i.id}
              onClick={() => setSelectedConversation(i.id)}
              className={cn(
                "rounded-sm text-zinc-400 p-1 gap-2 px-4 pr-1 items-center text-sm hover:bg-zinc-800 select-none transition-all flex flex-shrink-0",
                selectedConversation === i.id && "bg-zinc-800 text-white"
              )}
            >
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                {i.name}
              </span>
              <span className="text-xs flex-shrink-0">
                {displayDate(i.createdAt)}
              </span>
              <div className="flex-shrink-0">
                <DeleteConversation
                  onComplete={async () => await getData()}
                  conversation={i}
                />
              </div>
            </div>
          ))}
      </div>
    </ResizableContainer>
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
      <DialogContent className="dark">
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
  thinking,
}: {
  model: TomeAgentModel;
  onModelChange: React.Dispatch<SetStateAction<TomeAgentModel>>;
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
  thinking?: boolean;
}) {
  const handleSubmit = () => {
    if (input.trim()) {
      // Only submit if there's actual content
      onSubmit();
    }
  };

  return (
    <div className="bg-zinc-900 rounded-md border p-2 flex items-end gap-2 w-full max-w-2xl relative z-50">
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ModelPicker model={model} onModelChange={onModelChange} />
          {thinking && <Thinking />}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Enter a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-medium border-none bg-zinc-900 dark:bg-input/0 h-20"
            onKeyDown={(e) => {
              // Handle Cmd+Enter only within the textarea
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Tooltip delayDuration={1000}>
            <TooltipTrigger>
              <Button
                onClick={handleSubmit}
                variant="secondary"
                className="rounded-full has-[>svg]:p-2 h-fit"
              >
                <ArrowUp className="stroke-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>⌘ ↵ </TooltipContent>
          </Tooltip>
        </div>
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

    // If both providers are enabled, show all models
    if (openai.enabled && anthropic.enabled) {
      return TomeAgentModels;
    }

    // If only OpenAI is enabled, show OpenAI models
    if (openai.enabled && !anthropic.enabled) {
      return TomeAgentModels.filter((model) => model.provider === "Open AI");
    }

    // If only Anthropic is enabled, show Anthropic models
    if (!openai.enabled && anthropic.enabled) {
      return TomeAgentModels.filter((model) => model.provider === "Anthropic");
    }

    // If neither provider is enabled, return empty array
    return [];
  };

  const availableModels = getAvailableModels();

  // Check if the current model is still available
  const isCurrentModelAvailable = availableModels.some(
    (availableModel) => availableModel.name === model.name
  );

  // Group models by provider for better organization when both providers are enabled
  const groupedModels = useMemo(() => {
    if (availableModels.length === 0) return {};

    return availableModels.reduce((groups, model) => {
      const provider = model.provider;
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
      return groups;
    }, {} as Record<string, TomeAgentModel[]>);
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
        <SelectTrigger className="border !bg-zinc-950/40 !p-0 !h-fit !p-1 !px-2 text-xs opacity-50">
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
        const selectedModel = TomeAgentModels.find((i) => i.name === val);
        if (selectedModel) {
          onModelChange(selectedModel);
        }
      }}
    >
      <SelectTrigger className="border !bg-zinc-950/40 !p-0 !h-fit !p-1 !px-2 text-xs">
        <AIProviderLogo className="size-3.5" provider={model.provider} />
        {model.name}
      </SelectTrigger>
      <SelectContent className="dark">
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

function parseUIAction(response: string) {
  // Check if response is valid
  if (!response || typeof response !== "string") {
    return { message: "", action: null };
  }

  // Look for the last occurrence of <ui_action> tag
  const actionMatch = response.match(/<ui_action>(.*?)<\/ui_action>\s*$/);

  if (actionMatch) {
    // Extract the action content
    const action = actionMatch[1].trim();

    // Remove the ui_action tag from the message
    const message = response
      .replace(/<ui_action>.*?<\/ui_action>\s*$/, "")
      .trim();

    return {
      message: message.trim(),

      action: action,
    };
  }

  return {
    message: response.trim(),

    action: null,
  };
}

function toolDisplay(message: Omit<ConversationMessage, "id">) {
  if (message.role !== "tool-call") return;
  if (message.content === "getSchema") {
    if (message.toolCallStatus === "pending") {
      return "Getting schema...";
    }
    return "Retrieved schema";
  }

  if (
    message.content === "updateQuery" ||
    message.content === "updateQuerySection"
  ) {
    if (message.toolCallStatus === "pending") {
      return "Updating query...";
    }
    return "Updated query";
  }

  if (message.content === "runQuery") {
    if (message.toolCallStatus === "pending") {
      return "Running query...";
    }
    return "Ran query";
  }
}

function ChatMessage({
  message,
  sendMessage,
}: {
  message: Omit<ConversationMessage, "id">;
  sendMessage: (v: ChatMessage) => void;
}) {
  const { thinking } = useAgent();
  const fromUser = message.role === "user";

  const { message: cleanedMessage, action } = useMemo(() => {
    return parseUIAction(message.content);
  }, [message.content]);

  if (message.role === "tool-call") {
    return (
      <div className="border p-2 rounded-sm bg-zinc-900/75">
        <div className="flex gap-1.5 items-center text-xs text-zinc-400">
          {message.toolCallStatus === "pending" && (
            <Spinner className="size-3.5" />
          )}
          {message.toolCallStatus === "complete" && (
            <Check className="size-3.5 text-green-500" />
          )}
          {toolDisplay(message)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-auto max-w-xl",
        fromUser ? "items-end py-4" : "items-start"
      )}
    >
      <span
        className={cn(
          "pb-2 w-full flex text-xs text-zinc-400 capitalize",
          fromUser && "justify-end "
        )}
      >
        {message.role}
      </span>
      <div
        className={cn(
          "rounded-lg px-4 py-3 whitespace-pre-wrap break-words",
          fromUser ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-100"
        )}
      >
        <MarkdownRenderer content={cleanedMessage} />
        {thinking && (
          <div className="flex gap-1.5 items-center">
            <Spinner /> Thinking...
          </div>
        )}
        <UIAction sendMessage={sendMessage} action={action} />
      </div>
    </div>
  );
}

function UIAction({
  action,
  sendMessage,
}: {
  action: string | null;
  sendMessage: (v: ChatMessage) => void;
}) {
  if (action === "approve-query") {
    return (
      <div className="py-2 w-full flex justify-end">
        <Button
          className="bg-green-700/50 hover:bg-green-700/25 border border-green-500 text-green-400"
          onClick={() =>
            sendMessage({ role: "user", content: "Run the query" })
          }
        >
          Run Query
        </Button>
      </div>
    );
  }

  return null;
}
