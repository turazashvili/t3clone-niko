
-- Create a table to store active assistant streaming sessions and incremental message progress.
CREATE TABLE public.assistant_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message_id UUID, -- will point to the message row if/once persisted
  assistant_role TEXT NOT NULL DEFAULT 'assistant',
  status TEXT NOT NULL DEFAULT 'streaming', -- streaming | completed | error
  streamed_content TEXT DEFAULT '',
  streamed_reasoning TEXT DEFAULT '',
  openrouter_chunk_offset INTEGER DEFAULT 0, -- allows chunk tracking
  last_chunk_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index to look up by chat/message
CREATE INDEX idx_assistant_stream_sessions_chat ON public.assistant_stream_sessions(chat_id);
CREATE INDEX idx_assistant_stream_sessions_user ON public.assistant_stream_sessions(user_id);

-- RLS: allow only the owner (user_id == auth.uid()) to select, insert, update
ALTER TABLE public.assistant_stream_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can access their own assistant streaming sessions"
  ON public.assistant_stream_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "User can insert their own streaming sessions"
  ON public.assistant_stream_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "User can update their own streaming sessions"
  ON public.assistant_stream_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "User can delete their own streaming sessions"
  ON public.assistant_stream_sessions
  FOR DELETE
  USING (user_id = auth.uid());
