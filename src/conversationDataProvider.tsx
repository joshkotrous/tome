import {
  createContext,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Conversation, TomeMessage } from "./types";

interface ConversationDataContextValue {
  selectedConversation: Conversation | null;
  setSelectedConversation: React.Dispatch<SetStateAction<Conversation | null>>;
  currentMessages: TomeMessage[];
  refreshConversations: () => Promise<void>;
  conversations: Conversation[];
}

const ConversationDataContext = createContext<
  ConversationDataContextValue | undefined
>(undefined);

export function ConversationDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<TomeMessage[]>([]);

  async function getConversations() {
    const convos = await window.conversations.listConversations();
    setConversations(convos);
  }

  async function getMessages() {
    if (selectedConversation) {
      const msgs = await window.messages.listMessages(selectedConversation.id);
      setCurrentMessages(msgs);
    }
  }

  async function refreshConversations() {
    await getConversations();
  }

  useEffect(() => {
    getConversations();
  }, []);

  useEffect(() => {
    console.log(selectedConversation);
    getMessages();
  }, [selectedConversation]);

  const value = useMemo(
    () => ({
      selectedConversation,
      setSelectedConversation,
      conversations,
      currentMessages,
      refreshConversations,
    }),
    [
      selectedConversation,
      setSelectedConversation,
      conversations,
      currentMessages,
      refreshConversations,
    ]
  );

  return (
    <ConversationDataContext.Provider value={value}>
      {children}
    </ConversationDataContext.Provider>
  );
}

export function useConversationData() {
  const ctx = useContext(ConversationDataContext);
  if (!ctx) {
    throw new Error(
      "useConversationData must be used inside of ConversationDataProvider"
    );
  }

  return ctx;
}
