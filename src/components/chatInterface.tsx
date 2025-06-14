import {
  ArrowUp,
  MessageCircle,
  MessageCirclePlus,
  SidebarClose,
  Trash,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { SetStateAction, useEffect, useMemo, useState } from "react";
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
import {
  TomeAgentModel,
  TomeAnthropicAgentModelObject,
  TomeOAIAgentModel,
  TomeOAIAgentModelObject,
} from "../../core/ai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface() {
  const { settings } = useAppData();

  const [model, setModel] = useState<TomeAgentModel>("gpt-4o");

  useEffect(() => {
    setModel(
      settings?.aiFeatures.provider === "Open AI" ? "gpt-4o" : "claude-sonnet-4"
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
    send(msg.content, model, convo ?? undefined);
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
    <div className="flex flex-1 h-full min-h-0">
      <ConversationsList
        selectedConversation={selectedConversation}
        setSelectedConversation={setSelectedConversation}
      />
      {selectedConversation && messages.length > 0 && (
        <div className="flex space-y-4  flex-col flex-1 h-full  pb-4 overflow-auto mx-auto w-full max-w-5xl">
          <div className=" flex flex-col flex-1 p-4">
            {msgs.map((i) => (
              <div className={cn("flex", i.role === "user" && "justify-end")}>
                <ChatMessage sendMessage={sendMessage} message={i} />
              </div>
            ))}
            {thinking && <AnimatedEllipsis size="lg" />}
          </div>
          <div className="flex flex-col gap-2 sticky justify-center items-center w-full bottom-7 left-0 px-4">
            <div className="max-w-2xl w-full space-y-2">
              <div className="w-full">
                {thinking && (
                  <div className="flex gap-1.5 items-center text-sm">
                    <Spinner /> Thinking...
                  </div>
                )}
              </div>

              <ChatInput
                model={model}
                onModelChange={setModel}
                input={input}
                setInput={setInput}
                onSubmit={() => sendMessage({ role: "user", content: input })}
              />
            </div>
          </div>
        </div>
      )}
      {!selectedConversation && (
        <div className="flex  flex-col flex-1 w-full  px-8 items-center justify-center">
          <h2 className="text-center font-bold text-2xl  select-none">
            What can I help you with today?
          </h2>
          <div className="flex justify-center flex-wrap py-2 gap-1.5 ">
            {suggestions.map((i) => (
              <div
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
}: {
  model: TomeAgentModel;
  onModelChange: React.Dispatch<SetStateAction<TomeAgentModel>>;
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
}) {
  const handleSubmit = () => {
    if (input.trim()) {
      // Only submit if there's actual content
      onSubmit();
    }
  };

  return (
    <div className="bg-zinc-900 rounded-md border p-2 flex items-end gap-2 w-full max-w-2xl">
      <div className="w-full">
        <ModelPicker model={model} onModelChange={onModelChange} />
        <Textarea
          placeholder="Enter a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-medium border-none bg-zinc-900 dark:bg-input/0"
          onKeyDown={(e) => {
            // Handle Cmd+Enter only within the textarea
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </div>

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

  if (!settings) return null;

  const models =
    settings.aiFeatures.provider === "Open AI"
      ? TomeOAIAgentModelObject.options
      : TomeAnthropicAgentModelObject.options;

  return (
    <Select
      value={model}
      onValueChange={(val: TomeOAIAgentModel) => onModelChange(val)}
    >
      <SelectTrigger className="border-none">{model}</SelectTrigger>
      <SelectContent className="dark">
        {models.map((i) => (
          <SelectItem value={i}> {i}</SelectItem>
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

  return (
    <div
      className={cn(
        "overflow-auto max-w-xl",
        fromUser ? "items-end" : "items-start"
      )}
    >
      <span
        className={cn(
          "py-2 w-full flex text-xs text-zinc-400 capitalize",
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
