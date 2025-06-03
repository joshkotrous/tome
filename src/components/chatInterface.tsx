import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { SetStateAction, useState } from "react";
import { cn } from "@/lib/utils";
import { useAgent } from "@/useAgent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Spinner from "./ui/spinner";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const { msgs, send } = useAgent();
  function sendMessage(msg: ChatMessage) {
    send(msg.content);
    setInput("");
  }

  if (msgs.length > 0) {
    return (
      <div className="h-full px-8 pb-8 overflow-auto">
        <div className="w-full flex flex-col flex-1">
          {msgs.map((i) => (
            <div
              className={cn("flex w-full", i.role === "user" && "justify-end")}
            >
              <ChatMessage message={i} />
            </div>
          ))}
        </div>
        <div className="sticky bottom-0">
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
    <div className="flex flex-1 justify-center items-center">
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
    <div className="bg-zinc-900 rounded-md border p-2 flex items-end gap-2">
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

function ChatMessage({
  message,
}: {
  message: { role: "user" | "assistant"; content: string };
}) {
  const { thinking } = useAgent();
  const fromUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 py-2 w-full overflow-auto",
        fromUser ? "items-end" : "items-start"
      )}
    >
      <span className="text-xs text-zinc-400 capitalize">{message.role}</span>

      <div
        className={cn(
          "rounded-lg px-4 py-3 whitespace-pre-wrap break-words",
          fromUser ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-100"
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
        {thinking && (
          <div>
            <Spinner /> Thinking...
          </div>
        )}
      </div>
    </div>
  );
}
