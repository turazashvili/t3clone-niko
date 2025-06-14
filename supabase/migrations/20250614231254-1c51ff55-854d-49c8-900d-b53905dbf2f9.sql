
-- Add a column to indicate if a chat is public/shareable
ALTER TABLE public.chats
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Allow anyone to select chats if is_public = true
CREATE POLICY "Anyone can view public chats"
  ON public.chats FOR SELECT
  USING (is_public = TRUE);

-- (Keep existing owner policies for SELECT/UPDATE/DELETE for chat owner)
