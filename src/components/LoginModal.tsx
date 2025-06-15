
import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FcGoogle } from "react-icons/fc"; // Using react-icons for Google icon (you can use another icon if preferred)

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afterLogin?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onOpenChange, afterLogin }) => {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });
      if (error) {
        toast({ title: "Google login failed", description: error.message, variant: "destructive" });
        setLoading(false);
      } else {
        // After redirect, the app will handle login state.
        toast({ title: "Redirecting to Google…" });
      }
    } catch (err: any) {
      toast({ title: "Google login failed", description: err.message || String(err), variant: "destructive" });
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Sign In</DialogTitle>
        <DialogDescription>
          Please sign in with your Google account to continue.
        </DialogDescription>
        <div className="flex flex-col items-center space-y-6 mt-8">
          <Button
            type="button"
            className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-900 hover:bg-gray-100"
            onClick={handleGoogleSignIn}
            disabled={loading}
            variant="outline"
          >
            <FcGoogle size={22} />
            {loading ? "Signing in with Google..." : "Sign in with Google"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
