
import React from "react";
import PromptSwitcher from "@/components/PromptSwitcher";

interface EmptyStateProps {
  onPromptClick: (text: string) => void;
  user?: { full_name?: string | null }; // Now accepting user prop
}

// Get first name robustly
function getFirstName(fullName?: string | null) {
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return "there";
  }
  const trimmed = fullName.trim();
  const parts = trimmed.split(" ");
  return parts && parts.length > 0 && parts[0] ? parts[0] : trimmed;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onPromptClick, user }) => {
  const name = getFirstName(user?.full_name);

  return (
    <div className="flex-1 flex flex-col items-center justify-start pt-24">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
        How can I help you{ name ? `, ${name}` : ""}?
      </h1>
      <PromptSwitcher onPromptClick={onPromptClick} />
    </div>
  );
};

export default EmptyState;
