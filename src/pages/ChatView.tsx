
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage from "@/components/ChatMessage";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  reasoning?: string;
  attachedFiles?: any[];
}

export default function ChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChat = async () => {
      setLoading(true);
      setError(null);
      // Check chat exists and public
      const { data: chat, error: chatErr } = await supabase
        .from("chats")
        .select("id, is_public, title, created_at")
        .eq("id", chatId)
        .maybeSingle();
      if (chatErr) {
        setError("Unable to load chat");
        setLoading(false);
        return;
      }
      if (!chat) {
        setError("Chat not found");
        setLoading(false);
        return;
      }
      if (!chat.is_public) {
        setError("This chat is private.");
        setLoading(false);
        return;
      }
      setChat(chat);

      // Now fetch messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, role, content, created_at, reasoning, attachments")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      const mappedMessages: Message[] = (msgs ?? [])
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({
          id: msg.id,
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
          created_at: msg.created_at,
          reasoning: msg.reasoning,
          attachedFiles: msg.attachments || [],
        }));

      setMessages(mappedMessages);
      setLoading(false);
    };
    if (chatId) loadChat();
  }, [chatId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 text-center text-destructive">
        <div className="mb-2 font-bold text-lg">Error</div>
        <div>{error}</div>
        <Link className="underline mt-4 block" to="/">Back to chat</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="text-lg font-bold mb-2">Shared Chat</div>
      <div className="text-muted-foreground text-sm mb-6">
        This is a public shared chat. Messages are read-only.
      </div>
      <div className="max-w-3xl w-full space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
      </div>
      <Link to="/" className="mt-8 underline">Back to chat</Link>
    </div>
  );
}
