
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// CHANGE THIS AS DESIRED!
const DEFAULT_ASSISTANT_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

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
      .select("id, user_id, role, chat_id, model")
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

    // Get model from original user message, fallback to default if missing
    let prevModel = origMsg.model ?? DEFAULT_ASSISTANT_MODEL;

    // Gather prior messages (up to 8, as before)
    const { data: priorMessages } = await supabaseClient
      .from("messages")
      .select("role, content, created_at")
      .eq("chat_id", origMsg.chat_id)
      .lte("created_at", thisMsgFull?.created_at)
      .order("created_at", { ascending: true })
      .limit(8);

    // Compose OpenRouter messages (system, then history, then user)
    const openrouterMessages = [
      { role: "system", content: "You are a helpful AI assistant." },
      ...(priorMessages ?? []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: newContent }
    ];

    // Call OpenRouter
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not set in function environment." }), { status: 500, headers: corsHeaders });
    }

    const openrouterCall = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: prevModel,
        messages: openrouterMessages,
        stream: false,
        reasoning: { effort: "high" }
      }),
    });

    if (!openrouterCall.ok) {
      let err = "OpenRouter request error";
      try { 
        const errObj = await openrouterCall.json(); 
        err = errObj?.error?.message || JSON.stringify(errObj); 
      } catch { 
        try { err = await openrouterCall.text(); } catch {}
      }
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders });
    }

    const respData = await openrouterCall.json();

    let assistantContent = "";
    let assistantReasoning = "";

    // Some OpenRouter models may respond with just .choices[], some with .choices[].message.content, etc.
    if (respData.choices?.[0]?.message) {
      // Try new content/reasoning if present, else just .content
      const msg = respData.choices[0].message;
      if (typeof msg == "object") {
        assistantContent = msg.content ?? "";
        // If reasoning is present
        if ('reasoning' in msg) assistantReasoning = msg.reasoning ?? "";
      } else {
        assistantContent = msg;
      }
    } else if (respData.choices?.[0]?.delta) {
      assistantContent = respData.choices[0].delta.content ?? "";
      assistantReasoning = respData.choices[0].delta.reasoning ?? "";
    } else if (respData.choices?.[0]?.content) {
      assistantContent = respData.choices[0].content ?? "";
    }

    // Match the chat-handler format: store a JSON string if reasoning present
    let dbContent = (assistantReasoning !== "")
      ? JSON.stringify({ content: assistantContent, reasoning: assistantReasoning })
      : assistantContent;

    const { error: insertErr } = await supabaseClient
      .from("messages")
      .insert({
        chat_id: origMsg.chat_id,
        role: "assistant",
        content: dbContent,
        user_id: null, // AI-generated message
        model: prevModel,
      });

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Failed to save assistant message: " + insertErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, assistant: assistantContent, reasoning: assistantReasoning, model: prevModel }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), { status: 500, headers: corsHeaders });
  }
});
