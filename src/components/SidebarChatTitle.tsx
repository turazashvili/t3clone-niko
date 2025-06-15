
import React, { useRef, useEffect, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface SidebarChatTitleProps {
  title: string;
  fallback: string;
}

/**
 * Shows truncated title, and on hover, shows full title in a styled tooltip under cursor.
 * Tooltip appears only if content overflows.
 */
const SidebarChatTitle: React.FC<SidebarChatTitleProps> = ({ title, fallback }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = spanRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [title]);

  const renderTitle = (
    <span
      ref={spanRef}
      className="truncate flex-1 text-sm leading-tight"
      style={{ maxWidth: "12rem" }}
    >
      {title || fallback}
    </span>
  );

  // If the title isn't truncated, show plain, else add tooltip with custom design under cursor
  if (!isTruncated) {
    return renderTitle;
  }

  // Our custom tooltip: dark bg, accent border, white text, positioned below the trigger
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {renderTitle}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          className="!bg-[#222128] !text-[#d4d2ee] !border-[#8835bd] !rounded-md !font-medium !px-4 !py-2 !shadow-lg min-w-0"
          sideOffset={6}
        >
          <span className="whitespace-normal break-words">{title}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SidebarChatTitle;
