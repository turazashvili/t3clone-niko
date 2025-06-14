
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // For OpenAI API fetch

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// CHANGE THIS AS DESIRED!
const DEFAULT_ASSISTANT_MODEL = "openai/gpt-4o-mini";
const OPENAI_MODEL_ID_MAP: Record<string, string> = {
  "openai/gpt-4o-mini": "gpt-4o-mini",
  "openai/gpt-4o": "gpt-4o",
  // Add other model mappings if extended
};

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  try {
    const { id, newContent } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });
    const accessToken = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken);
    if (!user) return new Response(JSON.stringify({ error: userError?.message || "No user" }), { status: 401, headers: corsHeaders });

    // Verify message ownership
    const { data: origMsg, error: getError } = await supabaseClient
      .from("messages")
      .select("id, user_id, role, chat_id")
      .eq("id", id)
      .maybeSingle();

    if (getError || !origMsg || origMsg.role !== "user" || origMsg.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to edit this message." }), { status: 403, headers: corsHeaders });
    }

    // Update message content
    const { error: updateErr } = await supabaseClient
      .from("messages")
      .update({ content: newContent })
      .eq("id", id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsHeaders });
    }

    // Find all following messages in this chat (created after this msg)
    const { data: thisMsgFull } = await supabaseClient
      .from("messages")
      .select("created_at")
      .eq("id", id)
      .maybeSingle();

    // Delete all subsequent messages in the chat
    if (thisMsgFull?.created_at && origMsg.chat_id) {
      await supabaseClient
        .from("messages")
        .delete()
        .eq("chat_id", origMsg.chat_id)
        .gt("created_at", thisMsgFull.created_at);
    }

    // Find the previous model used for the assistant's reply
    let prevModel = DEFAULT_ASSISTANT_MODEL;

    // Find the immediate next assistant message after this one (to get prior model)
    const { data: nextAssistantMsg } = await supabaseClient
      .from("messages")
      .select("id, model, created_at, role")
      .eq("chat_id", origMsg.chat_id)
      .gt("created_at", thisMsgFull?.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextAssistantMsg?.model && nextAssistantMsg.role === "assistant") {
      prevModel = nextAssistantMsg.model;
    }

    // Generate new assistant response via LLM (OpenAI for now)
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set in function environment." }), { status: 500, headers: corsHeaders });
    }

    // Map system model id to OpenAI model id
    const openaiModelId = OPENAI_MODEL_ID_MAP[prevModel] || "gpt-4o-mini";

    // Grab last 4 user+assistant turns in this chat for history (before the edit)
    const { data: priorMessages } = await supabaseClient
      .from("messages")
      .select("role, content, created_at")
      .eq("chat_id", origMsg.chat_id)
      .lte("created_at", thisMsgFull?.created_at)
      .order("created_at", { ascending: true })
      .limit(8);

    // Compose context for OpenAI
    const systemPrompt = "You are a helpful AI assistant.";
    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...(priorMessages ?? []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: newContent }
    ];

    const openaiCall = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModelId,
        messages: openaiMessages,
        stream: false,
      }),
    });

    if (!openaiCall.ok) {
      let err = "OpenAI request error";
      try { err = await openaiCall.text(); } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders });
    }

    const respData = await openaiCall.json();
    const assistantContent = respData.choices?.[0]?.message?.content ?? "";

    // Store assistant message in DB
    const { error: insertErr } = await supabaseClient
      .from("messages")
      .insert({
        chat_id: origMsg.chat_id,
        role: "assistant",
        content: assistantContent,
        user_id: null, // AI-generated message
        model: prevModel,
      });

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Failed to save assistant message: " + insertErr.message }), { status: 500, headers: corsHeaders });
    }

    // Success: return new assistant content & model used
    return new Response(JSON.stringify({ success: true, assistant: assistantContent, model: prevModel }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), { status: 500, headers: corsHeaders });
  }
});
