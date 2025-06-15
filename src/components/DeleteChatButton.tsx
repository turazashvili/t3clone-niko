
import React, { useState } from "react";
import { Trash } from "lucide-react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeleteChatButtonProps {
  chatId: string;
  onDeleted?: () => void;
}

const DeleteChatButton: React.FC<DeleteChatButtonProps> = ({ chatId, onDeleted }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast({ title: "Delete failed", description: "User auth expired, please log in again.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const resp = await fetch(
        "https://tahxsobdcnbbqqonkhup.functions.supabase.co/delete-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ chatId }),
        }
      );
      if (resp.ok) {
        toast({ title: "Chat deleted" });
        setConfirmOpen(false);
        onDeleted?.();
      } else {
        const err = await resp.json();
        toast({ title: "Delete failed", description: err.error || "Unknown error", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogTrigger asChild>
        <button
          aria-label="Delete chat"
          className="opacity-0 group-hover/sidebar-chat:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/80 hover:text-white text-destructive"
          onClick={e => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          tabIndex={-1}
        >
          <Trash size={16} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this chat, all its messages, and all attached files. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/80" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteChatButton;

