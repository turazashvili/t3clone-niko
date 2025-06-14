
-- 1. Add a reasoning column to messages for separate, plain-text reasoning
ALTER TABLE public.messages ADD COLUMN reasoning TEXT;

-- (optional) Add a comment for documentation
COMMENT ON COLUMN public.messages.reasoning IS 'Reasoning or thinking text returned by the AI, as plain text/markdown, separated from main content';

