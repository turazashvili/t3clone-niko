
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

async function generateChatTitle(userPrompt: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY || !userPrompt) return null;
  // Gemini 2.0 Flash expects a quick system instruction and user prompt.
  // See OpenRouter docs for correct endpoint/model: https://openrouter.ai/docs#gemini/request
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-001",
        messages: [
          {
            role: "system",
            content: "Given a chat message, generate a very concise title (max 7 words, no quotes, no punctuation unless necessary, fit for sidebar labeling). Only return the title."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 50,
        temperature: 0.3,
        top_p: 0.8
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter Gemini title error:", error);
      return null;
    }
    const data = await response.json();
    let content = "";
    if (
      Array.isArray(data.choices) &&
      data.choices[0] &&
      data.choices[0].message &&
      typeof data.choices[0].message.content === "string"
    ) {
      content = data.choices[0].message.content.trim();
      if (content.length > 80) content = content.slice(0, 80); // Don't let crazy long titles through
      return content;
    }
    return null;
  } catch (err) {
    console.error("Gemini/OpenRouter error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { userId, title, prompt } = body;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let chatTitle = title ?? null;
    if (!chatTitle && typeof prompt === "string" && prompt.trim()) {
      const truncatedPrompt = prompt.trim().slice(0, 200);
      chatTitle = (await generateChatTitle(truncatedPrompt)) ?? null;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        title: chatTitle,
      }),
    });
    const data = await insertRes.json();
    if (!insertRes.ok) {
      return new Response(
        JSON.stringify({ error: data?.message || "Failed to create chat" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const newChat = Array.isArray(data) ? data[0] : data;
    return new Response(
      JSON.stringify({ chatId: newChat.id, chatTitle: newChat.title }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
