import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Required for Supabase client

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // Use service role for DB operations

// Add logs for debugging secrets presence
console.log("Edge function startup secrets check:");
console.log("OPENROUTER_API_KEY present?:", !!openRouterApiKey);
console.log("SUPABASE_URL present?:", !!supabaseUrl);
console.log("SUPABASE_SERVICE_ROLE_KEY present?:", !!supabaseServiceRoleKey);

const ALLOWED_MODELS = [
  "google/gemini-2.5-pro-preview",
  "openai/o4-mini",
  "openai/gpt-4.1",
  "openai/o1-pro",
  "anthropic/claude-opus-4",
  "anthropic/claude-sonnet-4",
  "deepseek/deepseek-r1-0528",
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatId, userMessageContent, userId, model, webSearchEnabled } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!userMessageContent) {
      return new Response(JSON.stringify({ error: 'Message content is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify which secrets are missing, if any
    const missingSecrets = [];
    if (!openRouterApiKey) missingSecrets.push('OPENROUTER_API_KEY');
    if (!supabaseUrl) missingSecrets.push('SUPABASE_URL');
    if (!supabaseServiceRoleKey) missingSecrets.push('SUPABASE_SERVICE_ROLE_KEY');

    if (missingSecrets.length > 0) {
      console.error("Missing environment variables in Edge Function:", missingSecrets.join(", "));
      return new Response(
        JSON.stringify({ error: 'Server configuration error', missingSecrets }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    let currentChatId = chatId;
    let conversationHistory = [];

    // 1. Create new chat if chatId is not provided
    if (!currentChatId) {
      const { data: newChat, error: newChatError } = await supabaseAdmin
        .from('chats')
        .insert({ user_id: userId, title: userMessageContent.substring(0, 50) })
        .select('id')
        .single();

      if (newChatError) throw newChatError;
      currentChatId = newChat.id;
    } else {
      // Fetch existing messages for context
      const { data: existingMessages, error: fetchMessagesError } = await supabaseAdmin
        .from('messages')
        .select('role, content')
        .eq('chat_id', currentChatId)
        .order('created_at', { ascending: true });

      if (fetchMessagesError) throw fetchMessagesError;
      conversationHistory = existingMessages.map(msg => ({ role: msg.role, content: msg.content }));
    }

    // 2. Save user's message
    const { error: userMessageError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: currentChatId,
        user_id: userId,
        role: 'user',
        content: userMessageContent,
      });
    if (userMessageError) throw userMessageError;

    conversationHistory.push({ role: 'user', content: userMessageContent });

    // 3. Prepare OpenRouter API streaming call
    let modelToUse = ALLOWED_MODELS.includes(model) ? model : "openai/o4-mini";
    let body: any = {
      model: modelToUse,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...conversationHistory,
      ],
      stream: true,
      reasoning: { effort: "high" },
    };
    if (webSearchEnabled) {
      if (typeof modelToUse === "string" && !modelToUse.endsWith(":online")) {
        body.model = modelToUse + ":online";
      }
    }

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json();
      console.error('OpenRouter API error:', errorData);
      throw new Error(`OpenRouter API error: ${errorData.error?.message || openRouterResponse.statusText}`);
    }

    // Parse SSE stream for reasoning and message content
    const decoder = new TextDecoder();
    const reader = openRouterResponse.body!.getReader();
    let done = false;
    let buffer = "";
    let assistantMessageContent = "";
    let reasoningContent = "";
    let inReasoning = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        // Extract complete lines
        while (true) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line || line.startsWith(":")) continue; // ignore comments

          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              // Reasoning is streamed as .delta.reasoning, content as .delta.content
              if (parsed.choices?.[0]?.delta?.reasoning !== undefined) {
                inReasoning = true;
                reasoningContent += parsed.choices[0].delta.reasoning;
              }
              if (parsed.choices?.[0]?.delta?.content !== undefined) {
                inReasoning = false;
                assistantMessageContent += parsed.choices[0].delta.content;
              }
            } catch {
              // ignore broken/partial JSON
            }
          }
        }
      }
      if (doneReading) done = true;
    }

    // Store BOTH in a structured JSON string (keeps schema) under content
    const combinedPayload = JSON.stringify({
      content: assistantMessageContent,
      reasoning: reasoningContent,
    });

    const { error: assistantMessageError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: currentChatId,
        role: 'assistant',
        content: combinedPayload, // Store as JSON string
      });
    if (assistantMessageError) throw assistantMessageError;

    return new Response(
      JSON.stringify({
        assistantResponse: combinedPayload,
        chatId: currentChatId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat-handler function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
