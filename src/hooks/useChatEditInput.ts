
import { useEffect } from "react";

export function useChatEditInput(setInputValue: (v: string) => void, inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>) {
  useEffect(() => {
    const cb = (e: CustomEvent) => {
      setInputValue(e.detail);
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
      }
    };
    window.addEventListener("chat-edit-message", cb as EventListener);
    return () => window.removeEventListener("chat-edit-message", cb as EventListener);
  }, [setInputValue, inputRef]);
}
