
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type StreamSession = {
  id: string;
  chat_id: string;
  user_id: string;
  status: string;
  streamed_content: string;
  streamed_reasoning: string;
  created_at: string;
  last_chunk_at: string;
};

export function useAssistantStreamSession({
  currentChatId,
  user,
}: {
  currentChatId: string | null;
  user: User | null;
}): {
  partialAssistant: { content: string; reasoning: string } | null;
  isStreaming: boolean;
} {
  const [session, setSession] = useState<StreamSession | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (user && currentChatId) {
      const fetchSession = async () => {
        const { data, error } = await supabase
          .from("assistant_stream_sessions")
          .select("*")
          .eq("chat_id", currentChatId)
          .eq("user_id", user.id)
          .eq("status", "streaming")
          .maybeSingle();
        if (!error && data) {
          setSession(data);
          setIsStreaming(true);
        } else {
          setSession(null);
          setIsStreaming(false);
        }
      };
      fetchSession();
      // Poll every 2s
      interval = setInterval(fetchSession, 2000);
    } else {
      setSession(null);
      setIsStreaming(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, currentChatId]);

  if (session && (session.streamed_content || session.streamed_reasoning)) {
    return {
      partialAssistant: {
        content: session.streamed_content || "",
        reasoning: session.streamed_reasoning || "",
      },
      isStreaming,
    };
  }
  return { partialAssistant: null, isStreaming: false };
}
