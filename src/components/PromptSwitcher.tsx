
import React, { useState } from "react";
import { PlusCircle, Newspaper, Code2, BookOpen } from "lucide-react";

// All prompt lists
const actionPrompts: Record<
  string,
  { label: string; icon: any; prompts: string[] }
> = {
  Create: {
    label: "Create",
    icon: PlusCircle,
    prompts: [
      "Write a short story about a robot discovering emotions",
      "Help me outline a sci-fi novel set in a post-apocalyptic world",
      "Create a character profile for a complex villain with sympathetic motives",
      "Give me 5 creative writing prompts for flash fiction",
    ],
  },
  Explore: {
    label: "Explore",
    icon: Newspaper,
    prompts: [
      "Good books for fans of Rick Rubin",
      "Countries ranked by number of corgis",
      "Most successful companies in the world",
      "How much does Claude cost?",
    ],
  },
  Code: {
    label: "Code",
    icon: Code2,
    prompts: [
      "Write code to invert a binary search tree in Python",
      "What's the difference between Promise.all and Promise.allSettled?",
      "Explain React's useEffect cleanup function",
      "Best practices for error handling in async/await",
    ],
  },
  Learn: {
    label: "Learn",
    icon: BookOpen,
    prompts: [
      "Beginner's guide to TypeScript",
      "Explain the CAP theorem in distributed systems",
      "Why is Al so expensive?",
      "Are black holes real?",
    ],
  },
};

interface PromptSwitcherProps {
  onPromptClick: (text: string) => void;
}

const PromptSwitcher: React.FC<PromptSwitcherProps> = ({ onPromptClick }) => {
  const [selected, setSelected] = useState<keyof typeof actionPrompts>("Create");

  return (
    <div className="w-full flex flex-col items-center">
      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center mb-7">
        {Object.entries(actionPrompts).map(([key, { label, icon: Icon }]) => (
          <button
            key={label}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold shadow transition ${
              selected === key
                ? "bg-accent text-white"
                : "bg-[#22182c]/70 text-white/90 hover:bg-accent hover:text-white"
            }`}
            onClick={() => setSelected(key as keyof typeof actionPrompts)}
            type="button"
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Prompts/questions */}
      <div className="w-full max-w-2xl mx-auto">
        {actionPrompts[selected].prompts.map((prompt, i) => (
          <div
            key={i}
            className="py-3 px-2 border-b border-[#32233e] text-white/90 hover:bg-[#251933] cursor-pointer transition text-lg font-normal"
            tabIndex={0}
            role="button"
            onClick={() => onPromptClick(prompt)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                onPromptClick(prompt);
              }
            }}
            aria-label={prompt}
          >
            {prompt}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptSwitcher;

