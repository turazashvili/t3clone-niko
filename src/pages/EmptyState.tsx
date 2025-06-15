
import React from "react";
import PromptSwitcher from "@/components/PromptSwitcher";

interface EmptyStateProps {
  onPromptClick: (text: string) => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onPromptClick }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-start pt-24">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
        How can I help you?
      </h1>
      <PromptSwitcher onPromptClick={onPromptClick} />
    </div>
  );
};

export default EmptyState;
