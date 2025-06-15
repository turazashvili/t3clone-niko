
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Copy, Share as ShareIcon } from "lucide-react";
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
      })
      .finally(() => setFetching(false));
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

  return (
    <div className="flex flex-col items-end gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Show spinner if fetching state */}
            <span>
              {fetching ? (
                <Button
                  variant="outline"
                  className="px-3 py-2 gap-2 rounded-lg shadow-sm border border-accent bg-background text-accent-foreground"
                  size="sm"
                  disabled
                  type="button"
                  data-testid="share-chat-btn"
                >
                  <span className="font-medium animate-pulse">...</span>
                </Button>
              ) : publicState ? (
                // Public: Show share and make private
                <span className="flex flex-row gap-2">
                  <Button
                    variant="outline"
                    className="px-3 py-2 gap-2 rounded-lg shadow-sm border border-accent bg-background text-accent-foreground hover:bg-accent hover:text-primary transition-all"
                    size="sm"
                    title="Copy public link"
                    onClick={handleCopy}
                    aria-label="Share chat"
                    type="button"
                    disabled={loading}
                    data-testid="share-chat-btn"
                  >
                    <ShareIcon size={18} />
                    <span className="font-medium">
                      {copied ? "Copied!" : "Share"}
                    </span>
                  </Button>
                  <Button
                    variant="destructive"
                    className="px-3 py-2 gap-2 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive-foreground hover:bg-destructive/30"
                    size="sm"
                    onClick={handleMakePrivate}
                    disabled={loading}
                  >
                    Make Private
                  </Button>
                </span>
              ) : (
                // Not public: offer to make public and share in one
                <Button
                  variant="outline"
                  className="px-3 py-2 gap-2 rounded-lg shadow-sm border border-accent bg-background text-accent-foreground hover:bg-accent hover:text-primary transition-all"
                  size="sm"
                  title="Make public & share link"
                  onClick={handleMakePublicAndShare}
                  aria-label="Make public and share chat"
                  type="button"
                  disabled={loading}
                  data-testid="share-chat-btn"
                >
                  <ShareIcon size={18} />
                  <span className="font-medium">
                    {loading ? "Making Public..." : "Make Public & Share"}
                  </span>
                </Button>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
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
      {publicState === false && (
        <span className="text-xs mt-1 text-destructive-foreground/90 bg-destructive/10 border border-destructive/20 px-2 py-1 rounded-sm animate-pulse">
          This chat is <b>not public</b>, so others won't be able to view it.
        </span>
      )}
      {publicState === true && (
        <span className="text-xs mt-1 text-green-900/90 bg-green-200/60 border border-green-500/20 px-2 py-1 rounded-sm">
          This chat is <b>public</b> and accessible via link.
        </span>
      )}
    </div>
  );
};

export default ShareChatButton;

