
import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Share } from "lucide-react";

interface ShareChatButtonProps {
  chatId?: string | null;
}

const ShareChatButton: React.FC<ShareChatButtonProps> = ({ chatId }) => {
  if (!chatId) return null;

  const shareUrl = `${window.location.origin}/chat/${chatId}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Chat link copied!", description: "You can now share this chat.", variant: "default" });
    } catch {
      toast({ title: "Failed to copy", description: "Please copy the link manually.", variant: "destructive" });
    }
  };

  return (
    <Button
      variant="secondary"
      className="gap-2"
      title="Copy share link"
      onClick={handleShare}
    >
      <Share size={18} />
      Share
    </Button>
  );
};

export default ShareChatButton;
