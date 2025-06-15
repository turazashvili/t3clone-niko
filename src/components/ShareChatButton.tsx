import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface ShareChatButtonProps {
  chatId?: string | null;
}

const ShareChatButton: React.FC<ShareChatButtonProps> = ({ chatId }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publicState, setPublicState] = useState<null | boolean>(null); // null means unknown
  const [fetching, setFetching] = useState(false);

  const shareUrl = chatId ? `${window.location.origin}/chat/${chatId}` : "";

  // Fetch is_public state from DB on mount & chatId change
  useEffect(() => {
    if (!chatId) {
      setPublicState(null);
      return;
    }
    let canceled = false;
    setFetching(true);
    supabase
      .from("chats")
      .select("is_public")
      .eq("id", chatId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!canceled) {
          if (error) setPublicState(null);
          else setPublicState(!!data?.is_public);
        }
        setFetching(false);
      });
    return () => {
      canceled = true;
    };
  }, [chatId]);

  if (!chatId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Anyone with this link can view the chat.",
      });
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  };

  // Make public and share (idempotent if already public)
  const handleMakePublicAndShare = async () => {
    if (loading) return;
    setLoading(true);
    // Update only if not already public
    if (!publicState) {
      const { error } = await supabase
        .from("chats")
        .update({ is_public: true })
        .eq("id", chatId);
      if (error) {
        toast({
          title: "Failed to make public",
          description: error.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      setPublicState(true);
      toast({
        title: "Chat is now public!",
        description: "Anyone with the link can view this chat.",
        variant: "default"
      });
    }
    await handleCopy();
    setLoading(false);
  };

  // Make chat private (remove public access)
  const handleMakePrivate = async () => {
    if (loading) return;
    setLoading(true);
    const { error } = await supabase
      .from("chats")
      .update({ is_public: false })
      .eq("id", chatId);
    if (error) {
      toast({
        title: "Failed to make private",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }
    setPublicState(false);
    toast({
      title: "Chat is now private",
      description: "Others will no longer have access via the link.",
      variant: "default"
    });
    setLoading(false);
  };

  // Design: compact, absolute top-right sticky group, minimal width
  return (
    <div className="flex flex-col gap-1 items-end w-fit max-w-xs">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              {fetching ? (
                <Button
                  variant="outline"
                  className="px-5 py-2 rounded-xl text-base font-medium shadow border border-accent bg-background text-accent-foreground"
                  size="sm"
                  disabled
                  type="button"
                  style={{ minWidth: 148, justifyContent: "flex-start" }}
                  data-testid="share-chat-btn"
                >
                  <span className="font-medium animate-pulse text-base">...</span>
                </Button>
              ) : publicState ? (
                <span className="flex flex-row gap-2">
                  <Button
                    variant="outline"
                    className="px-6 py-2 rounded-full text-base font-medium shadow border border-accent bg-background text-accent-foreground hover:bg-accent hover:text-primary transition-all"
                    size="sm"
                    title="Copy public link"
                    onClick={handleCopy}
                    aria-label="Share chat"
                    type="button"
                    style={{ minWidth: 120, justifyContent: "flex-start" }}
                    disabled={loading}
                  >
                    <Upload size={20} strokeWidth={2.1} className="mr-2 -ml-1" />
                    <span>{copied ? "Copied!" : "Share"}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    className="px-4 py-2 rounded-full border border-destructive/50 bg-destructive/10 text-destructive-foreground hover:bg-destructive/30 text-base"
                    size="sm"
                    onClick={handleMakePrivate}
                    disabled={loading}
                  >
                    Make Private
                  </Button>
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="px-6 py-2 rounded-full text-base font-medium shadow border border-accent bg-background text-accent-foreground hover:bg-accent hover:text-primary transition-all"
                  size="sm"
                  title="Make public & share link"
                  onClick={handleMakePublicAndShare}
                  aria-label="Make public and share chat"
                  type="button"
                  style={{ minWidth: 180, justifyContent: "flex-start" }}
                  disabled={loading}
                  data-testid="share-chat-btn"
                >
                  <Upload size={20} strokeWidth={2.1} className="mr-2 -ml-1" />
                  <span>
                    {loading ? "Making Public..." : "Make Public & Share"}
                  </span>
                </Button>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="text-xs">
            <span>
              {publicState === null
                ? "Checking sharing status..."
                : publicState
                  ? "Copy public link or make the chat private"
                  : "Make this chat public and copy the link"}
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Badge */}
      {publicState === false && (
        <span
          className="text-[15px] mt-1 text-destructive-foreground/90 bg-destructive/10 border border-destructive/30 px-3 py-1 rounded-md font-normal whitespace-nowrap shadow-sm"
          style={{
            fontWeight: 400,
            boxShadow: "none",
            maxWidth: 280,
            whiteSpace: "pre-line",
          }}
        >
          This chat is <b className="font-semibold">not public</b>, so others won't be able to view it.
        </span>
      )}
      {publicState === true && (
        <span
          className="text-[15px] mt-1 text-green-900/90 bg-green-200/60 border border-green-500/20 px-3 py-1 rounded-md font-normal whitespace-nowrap shadow-sm"
          style={{
            fontWeight: 400,
            boxShadow: "none",
            maxWidth: 280,
            whiteSpace: "pre-line",
          }}
        >
          This chat is <b className="font-semibold">public</b> and accessible via link.
        </span>
      )}
    </div>
  );
};

export default ShareChatButton;
