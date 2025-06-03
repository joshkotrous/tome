import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { SetStateAction, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAgent } from "@/useAgent";
import Spinner from "./ui/spinner";
import MarkdownRenderer from "./markdownRederer";
import { Message } from "ai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const { msgs, send, thinking } = useAgent();
  function sendMessage(msg: ChatMessage) {
    send(msg.content);
    setInput("");
  }

  if (msgs.length > 0) {
    return (
      <div className="flex  flex-col relative h-full  pb-4 overflow-auto mx-auto w-full max-w-5xl">
        <div className=" flex flex-col flex-1 p-4">
          {msgs.map((i) => (
            <div className={cn("flex", i.role === "user" && "justify-end")}>
              <ChatMessage sendMessage={sendMessage} message={i} />
            </div>
          ))}
        </div>
        <div className="flex sticky justify-center w-full bottom-2 left-0 px-4">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={() => sendMessage({ role: "user", content: input })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center  items-center">
      <div className="w-full max-w-2xl px-8">
        <h2 className="text-center font-bold text-2xl  select-none">
          What can I help you with today?
        </h2>
        <div className="flex justify-center flex-wrap py-2 gap-1.5 ">
          <div className="text-xs px-2 p-1 border rounded-full bg-zinc-900 hover:bg-zinc-800 select-none transition-all">
            Run query
          </div>
          <div className="text-xs px-2 p-1 border rounded-full bg-zinc-900 hover:bg-zinc-800 select-none transition-all">
            Visualize Data
          </div>
          <div className="text-xs px-2 p-1 border rounded-full bg-zinc-900 hover:bg-zinc-800 select-none transition-all">
            Analyze Data
          </div>
          <div className="text-xs px-2 p-1 border rounded-full bg-zinc-900 hover:bg-zinc-800 select-none transition-all">
            Ask a question
          </div>
        </div>
        {thinking && (
          <div className="flex gap-1.5 items-center">
            <Spinner /> Thinking...
          </div>
        )}
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={() => sendMessage({ role: "user", content: input })}
        />
      </div>
    </div>
  );
}

function ChatInput({
  input,
  setInput,
  onSubmit,
}: {
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-md border p-2 flex items-end gap-2 w-full max-w-2xl">
      <Textarea
        placeholder="Enter a message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="font-medium border-none bg-zinc-900 dark:bg-input/0"
      />
      <Button
        onClick={onSubmit}
        variant="secondary"
        className="rounded-full has-[>svg]:p-2 h-fit"
      >
        <ArrowUp className="stroke-3" />
      </Button>
    </div>
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
      message: message
        .trim()
        .replace("<ui_action>", "")
        .replace("</ui_action>", ""),
      action: action,
    };
  }

  return {
    message: response
      .trim()
      .replace("<ui_action>", "")
      .replace("</ui_action>", ""),
    action: null,
  };
}

function ChatMessage({
  message,
  sendMessage,
}: {
  message: Omit<Message, "id">;
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
