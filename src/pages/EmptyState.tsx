
import React from "react";
import PromptSwitcher from "@/components/PromptSwitcher";
import { useChat } from "@/hooks/useChat";

const EmptyState: React.FC = () => {
  const { setInputValue } = useChat();

  return (
    <div className="flex-1 flex flex-col items-center justify-start pt-24">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
        How can I help you?
      </h1>
      <PromptSwitcher onPromptClick={setInputValue} />
    </div>
  );
};

export default EmptyState;

