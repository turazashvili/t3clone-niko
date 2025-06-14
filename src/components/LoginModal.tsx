
import React, { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afterLogin?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onOpenChange, afterLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isLogin) {
      // Log in
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Logged in!", description: "You are now logged in." });
        onOpenChange(false);
        afterLogin?.();
      }
    } else {
      // Sign up
      const redirectTo = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo }
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "A confirmation email has been sent." });
        setIsLogin(true);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{isLogin ? "Sign In" : "Sign Up"}</DialogTitle>
        <DialogDescription>
          {isLogin ? "Welcome back! Please enter your account details." : "Create a new account."}
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <Input
              id="login-email"
              name="email"
              autoComplete="email"
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <Input
              id="login-password"
              name="password"
              autoComplete="current-password"
              type="password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
          </div>
          {error && (
            <div className="text-destructive text-sm font-medium">{error}</div>
          )}
          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading
              ? (isLogin ? "Signing in..." : "Signing up...")
              : (isLogin ? "Sign In" : "Sign Up")}
          </Button>
        </form>
        <div className="text-center text-sm mt-3">
          {isLogin ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                className="underline text-accent hover:text-accent-dark"
                onClick={() => setIsLogin(false)}
                disabled={loading}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="underline text-accent hover:text-accent-dark"
                onClick={() => setIsLogin(true)}
                disabled={loading}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
