
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ChatShareDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatShareDialog: React.FC<ChatShareDialogProps> = ({ chatId, open, onOpenChange }) => {
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const shareUrl = chatId ? `${window.location.origin}/chat/${chatId}` : "";

  // Fetch public state
  useEffect(() => {
    let cancelled = false;
    if (!open || !chatId) return;
    setIsPublic(null);

    supabase.from("chats").select("is_public").eq("id", chatId).maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setIsPublic(data?.is_public ?? false);
      });

    return () => { cancelled = true; };
  }, [open, chatId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Anyone with this link can view the chat."
      });
    } catch {
      toast({
        title: "Failed to copy link",
        description: "Please copy manually.",
        variant: "destructive"
      });
    }
  };

  const handleMakePublic = async () => {
    setLoading(true);
    const { error } = await supabase.from("chats").update({ is_public: true }).eq("id", chatId);
    setLoading(false);
    if (error) {
      toast({
        title: "Failed to make public",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setIsPublic(true);
      toast({
        title: "Chat is now public!",
        description: "Anyone with the link can view this chat."
      });
    }
  };

  const handleMakePrivate = async () => {
    setLoading(true);
    const { error } = await supabase.from("chats").update({ is_public: false }).eq("id", chatId);
    setLoading(false);
    if (error) {
      toast({
        title: "Failed to make private",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setIsPublic(false);
      toast({
        title: "Chat is now private.",
        description: "Only you can access it now."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share or Secure this Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              Visibility:
              {isPublic ? (
                <span className="flex items-center gap-1 text-green-700 ml-2"><ShieldCheck size={16}/> Public</span>
              ) : isPublic === false ? (
                <span className="flex items-center gap-1 text-red-700 ml-2"><ShieldOff size={16}/> Private</span>
              ) : (
                <span className="text-xs ml-2 text-muted-foreground">Checking...</span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {isPublic ? (
              <>
                <Button onClick={handleMakePrivate} variant="destructive" disabled={loading} className="flex-1">
                  Make Private
                </Button>
                <Button onClick={handleCopy} variant="outline" disabled={!chatId} className="flex-1">
                  <Copy size={16} className="mr-1"/> Copy Link
                </Button>
              </>
            ) : (
              <Button onClick={handleMakePublic} variant="default" disabled={loading || isPublic === null} className="w-full">
                Make Public
              </Button>
            )}
          </div>
          {isPublic && (
            <div className="flex items-center justify-between text-xs bg-muted px-2 py-1 rounded border border-muted-foreground/10">
              <span className="truncate">{shareUrl}</span>
              <Button size="sm" variant="ghost" onClick={handleCopy}><Copy size={14} /></Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatShareDialog;
