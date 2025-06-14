
-- Add attachments column to messages, store metadata array as JSON
ALTER TABLE public.messages
ADD COLUMN attachments jsonb DEFAULT '[]';

-- (optional but recommended) Add comment for clarity
COMMENT ON COLUMN public.messages.attachments IS 'List of attachment objects (name, url, type) for each message, stored as JSON array.';

