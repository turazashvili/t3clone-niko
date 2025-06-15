
import React, { useRef, useEffect, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface SidebarChatTitleProps {
  title: string;
  fallback: string;
}

/**
 * Shows truncated title, and on hover, shows full title in a styled tooltip.
 * Tooltip appears only if content overflows.
 */
const SidebarChatTitle: React.FC<SidebarChatTitleProps> = ({ title, fallback }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = spanRef.current;
    if (el) {
      // Detect overflow (truncation)
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [title]);

  const renderTitle = (
    <span
      ref={spanRef}
      className="truncate flex-1 text-sm leading-tight"
      style={{ maxWidth: "12rem" }}
      title={!isTruncated ? undefined : title}
    >
      {title || fallback}
    </span>
  );

  // If the title isn't truncated, show plain, else add tooltip
  if (!isTruncated) {
    return renderTitle;
  }

  // Custom tooltip: dark bg, accent border, white text to match the design
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {renderTitle}
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="!bg-[#23142e] !text-white !border-accent !rounded-md !font-semibold !px-4 !py-2 max-w-xs break-words shadow-lg"
        >
          <span>{title}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SidebarChatTitle;
