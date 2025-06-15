
import React, { useEffect, useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Cog, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ShareChatDialogProps {
  chatId?: string | null;
  /** Added optional prop to allow always-visible, inline button if needed */
  buttonClassName?: string;
}

const ShareChatDialog: React.FC<ShareChatDialogProps> = ({ chatId, buttonClassName }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publicState, setPublicState] = useState<null | boolean>(null);
  const [fetching, setFetching] = useState(false);

  const shareUrl = chatId ? `${window.location.origin}/chat/${chatId}` : "";

  // Fetch is_public state from DB on mount & chatId change
  useEffect(() => {
    if (!chatId || !open) {
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
  }, [chatId, open]);

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

  const handleMakePublic = async () => {
    if (loading || !chatId) return;
    setLoading(true);
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
    setLoading(false);
  };

  const handleMakePrivate = async () => {
    if (loading || !chatId) return;
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

  if (!chatId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={buttonClassName || "ml-2 p-0"}
          aria-label="Chat settings"
          style={{ boxShadow: "none" }}
        >
          <Cog size={22} strokeWidth={2.2} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs w-full rounded-2xl border gap-4 p-6 shadow-lg bg-background">
        <DialogHeader>
          <DialogTitle>Chat Sharing</DialogTitle>
          <DialogDescription>
            Manage this chat's visibility and get a public link to share.
          </DialogDescription>
        </DialogHeader>

        {/* Share/Status section */}
        <div className="flex flex-col items-center gap-3 my-2">
          {publicState === false && (
            <div className="w-full text-[15px] text-destructive-foreground/90 bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-md font-normal text-center">
              This chat is <b className="font-semibold">not public</b>, so others won't be able to view it.
            </div>
          )}
          {publicState === true && (
            <div className="w-full text-[15px] text-green-900/90 bg-green-200/60 border border-green-500/20 px-3 py-2 rounded-md font-normal text-center">
              This chat is <b className="font-semibold">public</b> and accessible via link.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full">
          {publicState ? (
            <>
              <Button
                variant="outline"
                className="w-full rounded-full flex items-center gap-2"
                onClick={handleCopy}
                disabled={loading}
              >
                <Upload size={18} className="mr-2" />
                {copied ? "Copied!" : "Copy Public Link"}
              </Button>
              <Button
                variant="destructive"
                className="w-full rounded-full"
                onClick={handleMakePrivate}
                disabled={loading}
              >
                Make Private
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-full flex items-center gap-2"
              onClick={handleMakePublic}
              disabled={loading}
            >
              <Upload size={18} className="mr-2" />
              {loading ? "Making Public..." : "Make Public & Share"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareChatDialog;
