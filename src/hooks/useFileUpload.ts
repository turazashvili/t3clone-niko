
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UploadedFile = {
  name: string;
  type: string;
  url: string;
  originalFile: File;
};

export function useFileUpload(bucket: string = "chat-attachments") {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<UploadedFile | null> => {
    setUploading(true);
    setError(null);

    // Unique name (timestamp+random+original)
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      setError(error.message);
      setUploading(false);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    setUploading(false);

    return {
      name: file.name,
      type: file.type,
      url: urlData?.publicUrl || "",
      originalFile: file,
    };
  };

  return { upload, uploading, error };
}
