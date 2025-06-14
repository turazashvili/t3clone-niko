
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Image as ImageIcon, File as FileIcon, X } from "lucide-react";

interface AttachmentViewerDialogProps {
  open: boolean;
  file: {
    name: string;
    url: string;
    type: string;
  } | null;
  onClose: () => void;
}

const isImageType = (fileType: string) => fileType.startsWith("image/");

const AttachmentViewerDialog: React.FC<AttachmentViewerDialogProps> = ({
  open,
  file,
  onClose,
}) => {
  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl flex flex-col items-center justify-center">
        <button
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>
        {isImageType(file.type) ? (
          <>
            <img
              src={file.url}
              alt={file.name}
              className="max-h-[60vh] max-w-full rounded shadow mb-4"
              style={{ background: "#181638" }}
            />
            <div className="text-xs text-white/90 flex items-center">
              <ImageIcon size={16} className="mr-2" />
              {file.name}
            </div>
          </>
        ) : (
          <>
            <FileIcon size={40} className="mb-3 text-blue-300" />
            <div className="mb-2 font-medium">{file.name}</div>
            <a
              href={file.url}
              download
              className="text-blue-400 hover:underline text-sm"
            >
              Download
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentViewerDialog;
