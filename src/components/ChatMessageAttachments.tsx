
import React from "react";
import { Image as ImageIcon, File as FileIcon } from "lucide-react";
import { UploadedFile } from "@/hooks/useFileUpload";

interface ChatMessageAttachmentsProps {
  files: UploadedFile[];
  onAttachmentClick: (file: UploadedFile) => void;
}

const isImageType = (fileType: string) => fileType.startsWith("image/");

const ChatMessageAttachments: React.FC<ChatMessageAttachmentsProps> = ({ files, onAttachmentClick }) => {
  if (!files.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3 items-center">
      {files.map((file, idx) => (
        <div key={idx} className="flex flex-col items-center">
          {isImageType(file.type) ? (
            <button
              type="button"
              onClick={() => onAttachmentClick(file)}
              className="block group bg-transparent border-none outline-none p-0"
              tabIndex={0}
            >
              <img
                src={file.url}
                alt={file.name}
                className="w-24 h-24 object-cover rounded shadow border border-white/10 group-hover:scale-105 transition"
              />
              <div className="text-xs text-white/70 text-center mt-1 truncate max-w-[90px]">
                <ImageIcon size={14} className="inline-block mr-1 align-text-bottom" />
                {file.name}
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAttachmentClick(file)}
              className="flex items-center gap-1 text-xs text-blue-200 hover:underline px-2 py-1 rounded bg-white/10"
              tabIndex={0}
            >
              <FileIcon size={14} />
              {file.name}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChatMessageAttachments;
