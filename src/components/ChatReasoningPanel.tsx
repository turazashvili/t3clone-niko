
import React from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatReasoningPanelProps {
  reasoning: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ChatReasoningPanel: React.FC<ChatReasoningPanelProps> = ({ reasoning, open, setOpen }) => (
  <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
    <CollapsibleTrigger asChild>
      <button className="flex items-center gap-2 text-xs text-blue-200 font-semibold bg-[#232240] hover:bg-[#2f2b50] rounded px-3 py-2 mb-1 transition w-full">
        <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${open ? "rotate-180" : ""}`} />
        Model’s thinking (reasoning)
        <span className="ml-auto text-[10px] opacity-60">(Click to {open ? "hide" : "show"})</span>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="text-xs bg-[#181638]/60 rounded p-2">
      <ReactMarkdown
        components={{
          p: (props) => (
            <p className="my-1 leading-relaxed" {...props} />
          ),
          hr: (props) => (
            <hr className="my-3 border-white/10" />
          ),
          code({node, className, children, ...props}) {
            const match = /language-(\w+)/.exec(props.className || "");
            // For block code
            // @ts-ignore
            if (!props.inline && match) {
              return (
                <SyntaxHighlighter
                  style={atomDark}
                  language={match[1]}
                  PreTag="div"
                  className="my-2 rounded-lg text-sm"
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }
            return (
              <code className="rounded bg-[#312a4b] px-1.5 py-0.5 text-xs" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {reasoning}
      </ReactMarkdown>
    </CollapsibleContent>
  </Collapsible>
);

export default ChatReasoningPanel;
