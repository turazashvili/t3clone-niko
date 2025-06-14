
-- Allow public read access only to chats marked as public
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Policy for reading public chats (for anyone)
CREATE POLICY "Public can view public chats"
  ON public.chats
  FOR SELECT
  USING (is_public = true);

-- Allow chat owners to view their own (private) chats
CREATE POLICY "Chat owners can view their chats"
  ON public.chats
  FOR SELECT
  USING (user_id = auth.uid());

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy for reading messages for public chats
CREATE POLICY "Public can view messages of public chats"
  ON public.messages
  FOR SELECT
  USING (
    (SELECT is_public FROM public.chats WHERE id = messages.chat_id) = true
  );

-- Allow chat owners to view messages of their own chats
CREATE POLICY "Chat owners can view their chat messages"
  ON public.messages
  FOR SELECT
  USING (
    (SELECT user_id FROM public.chats WHERE id = messages.chat_id) = auth.uid()
  );
