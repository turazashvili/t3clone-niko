
// Deno/Edge Function: Message Edit with SSE Streaming (like chat-handler)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const DEFAULT_ASSISTANT_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and check params
    const { id, newContent, modelOverride } = await req.json();
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });
    const accessToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken);
    if (!user) return new Response(JSON.stringify({ error: userError?.message || "No user" }), { status: 401, headers: corsHeaders });

    // Get user message
    const { data: origMsg, error: getError } = await supabaseClient
      .from("messages")
      .select("id, user_id, role, chat_id, model, content")
      .eq("id", id)
      .maybeSingle();
    if (getError || !origMsg || origMsg.role !== "user" || origMsg.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to edit this message." }), { status: 403, headers: corsHeaders });
    }

    // Conditionally update content if needed
    let latestContent = origMsg.content;
    if (
      typeof newContent === "string" &&
      newContent.trim() !== "" &&
      newContent.trim() !== origMsg.content.trim()
    ) {
      const { error: updateErr } = await supabaseClient
        .from("messages")
        .update({ content: newContent })
        .eq("id", id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsHeaders });
      }
      latestContent = newContent;
    }

    // Get (edited) message's created_at
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

    // Pick model
    const modelToUse = typeof modelOverride === "string" && modelOverride.trim() !== ""
      ? modelOverride.trim()
      : (origMsg.model ?? DEFAULT_ASSISTANT_MODEL);

    // Get prior messages up to 8 messages before/including the edit
    const { data: priorMessages } = await supabaseClient
      .from("messages")
      .select("role, content, created_at")
      .eq("chat_id", origMsg.chat_id)
      .lte("created_at", thisMsgFull?.created_at)
      .order("created_at", { ascending: true })
      .limit(8);

    // Compose prompt for OpenRouter
    const openrouterMessages = [
      { role: "system", content: "You are a helpful AI assistant." },
      ...(priorMessages ?? []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: latestContent }
    ];

    // Stream OpenRouter
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not set in function environment." }), { status: 500, headers: corsHeaders });
    }

    // Start OpenRouter stream
    const openrouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: openrouterMessages,
        stream: true,
        reasoning: { effort: "high" }
      }),
    });

    if (!openrouterResp.ok) {
      let err = "OpenRouter request error";
      try {
        const errObj = await openrouterResp.json();
        err = errObj?.error?.message || JSON.stringify(errObj);
      } catch {
        try { err = await openrouterResp.text(); } catch {}
      }
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders });
    }

    // SSE streaming logic
    let assistantContent = "";
    let assistantReasoning = "";

    // Set up SSE response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const reader = openrouterResp.body!.getReader();
            let done = false;
            let buffer = "";
            while (!done) {
              const { value, done: doneReading } = await reader.read();
              if (doneReading) {
                done = true;
                continue;
              }
              buffer += decoder.decode(value, { stream: true });
              while (true) {
                const lineEnd = buffer.indexOf('\n');
                if (lineEnd === -1) break;
                const line = buffer.slice(0, lineEnd).trim();
                buffer = buffer.slice(lineEnd + 1);

                if (!line || line.startsWith(":")) continue;

                if (line.startsWith('data: ')) {
                  const data = line.substring(6);
                  if (data === '[DONE]') {
                    done = true;
                    break;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    // Stream reasoning if present
                    if (parsed.choices?.[0]?.delta?.reasoning !== undefined) {
                      assistantReasoning += parsed.choices[0].delta.reasoning;
                      controller.enqueue(encoder.encode(`event: reasoning\ndata: ${JSON.stringify({ reasoning: assistantReasoning })}\n\n`));
                    }
                    if (parsed.choices?.[0]?.delta?.content !== undefined) {
                      assistantContent += parsed.choices[0].delta.content;
                      controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`));
                    }
                  } catch {}
                }
              }
            }
            // Send finished event
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  content: assistantContent,
                  reasoning: assistantReasoning,
                  model: modelToUse,
                })}\n\n`
              )
            );
            controller.close();

            // Save AI response (content/reasoning) to DB as one message
            await supabaseClient
              .from("messages")
              .insert({
                chat_id: origMsg.chat_id,
                role: "assistant",
                content: assistantContent,
                reasoning: assistantReasoning,
                user_id: null,
                model: modelToUse,
              });
          } catch (e) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e.message || "Internal error" })}\n\n`));
            controller.close();
          }
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), { status: 500, headers: corsHeaders });
  }
});
