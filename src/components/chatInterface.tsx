import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { SetStateAction, useState } from "react";
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
  const { msgs, send } = useAgent();
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
              <ChatMessage message={i} />
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

function ChatMessage({ message }: { message: Omit<Message, "id"> }) {
  const { thinking } = useAgent();
  const fromUser = message.role === "user";

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
        <MarkdownRenderer content={message.content} />
        {thinking && (
          <div>
            <Spinner /> Thinking...
          </div>
        )}
      </div>
    </div>
  );
}
