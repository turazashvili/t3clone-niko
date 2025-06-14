
-- Add a `model` column to store the LLM model used to generate each message
ALTER TABLE public.messages ADD COLUMN model TEXT;

-- (Optionally) add a comment for documentation
COMMENT ON COLUMN public.messages.model IS 'Which LLM model was used for this message (e.g., openai/gpt-4, openai/gpt-4o-mini)';
