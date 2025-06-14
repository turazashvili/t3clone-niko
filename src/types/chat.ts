
import { UploadedFile } from "@/hooks/useFileUpload";
import { LLMModel } from "./llm-model";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  reasoning?: string;
  attachedFiles?: UploadedFile[];
  chat_id?: string;
}

export type { LLMModel };
