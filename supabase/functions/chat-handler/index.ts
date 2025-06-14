
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Required for Supabase client

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // Use service role for DB operations

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

    // 3. Call OpenRouter API with streaming, with proper model+websearch logic
    let modelToUse = ALLOWED_MODELS.includes(model) ? model : "openai/o4-mini";
    let body: any = {
      model: modelToUse,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...conversationHistory,
      ],
      stream: true
    };

    // Add websearch if enabled
    if (webSearchEnabled) {
      if (typeof modelToUse === "string" && !modelToUse.endsWith(":online")) {
        body.model = modelToUse + ":online";
      }
    }

    // Send request to OpenRouter and stream response
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!openRouterResponse.ok || !openRouterResponse.body) {
      const errorData = await openRouterResponse.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${errorData.error?.message || openRouterResponse.statusText}`);
    }

    // Prepare streaming response to client
    const decoder = new TextDecoder();
    let assistantMessageContent = "";
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openRouterResponse.body.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // OpenRouter streams in SSE format, lines prefixed by "data: "
            let lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data:")) {
                const jsonStr = trimmed.substring(5).trim();
                if (jsonStr === "[DONE]") {
                  controller.close();
                  break;
                }
                try {
                  const data = JSON.parse(jsonStr);
                  const delta = data.choices?.[0]?.delta?.content ?? "";
                  if (delta) {
                    assistantMessageContent += delta;
                    controller.enqueue(new TextEncoder().encode(delta));
                  }
                } catch (err) {
                  // Ignore bad chunks
                }
              }
            }
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });

    // After stream ends, save assistant message to DB in background
    stream
      .getReader()
      .closed
      .then(async () => {
        if (assistantMessageContent.trim()) {
          await supabaseAdmin
            .from('messages')
            .insert({
              chat_id: currentChatId,
              role: 'assistant',
              content: assistantMessageContent,
            });
        }
      });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (error) {
    console.error('Error in chat-handler function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
