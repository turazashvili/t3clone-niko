
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "types/supabase";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const { chatId } = await req.json();
  const supabase = createClient<Database>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );
  // Auth check
  const {
    data: chat,
    error: chatError,
  } = await supabase.from("chats").select("id,user_id").eq("id", chatId).maybeSingle();
  if (chatError) {
    return new Response(JSON.stringify({ error: chatError.message }), { status: 500, headers: corsHeaders });
  }
  // Get user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  if (chat?.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }
  // Fetch messages with attachments
  const { data: messages } = await supabase
    .from("messages")
    .select("id,attachments")
    .eq("chat_id", chatId);
  for (const msg of messages || []) {
    const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
    for (const file of attachments) {
      if (file.bucket && file.path) {
        // best effort: ignore errors
        await supabase.storage.from(file.bucket).remove([file.path]);
      }
    }
  }
  // Delete messages
  const { error: messagesError } = await supabase.from("messages").delete().eq("chat_id", chatId);
  if (messagesError) {
    return new Response(JSON.stringify({ error: "Messages deletion error: " + messagesError.message }), { status: 500, headers: corsHeaders });
  }
  // Delete chat
  const { error: chatDelError } = await supabase.from("chats").delete().eq("id", chatId);
  if (chatDelError) {
    return new Response(JSON.stringify({ error: "Chat deletion error: " + chatDelError.message }), { status: 500, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
});
