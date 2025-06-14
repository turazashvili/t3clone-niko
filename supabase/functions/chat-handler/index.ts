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

// BEGIN: Allowed models list generated from models.json
const ALLOWED_MODELS = [
  "openai/o3-pro",
  "google/gemini-2.5-pro-preview",
  "deepseek/deepseek-r1-distill-qwen-7b",
  "deepseek/deepseek-r1-0528",
  "anthropic/claude-opus-4",
  "anthropic/claude-sonnet-4",
  "google/gemini-2.5-flash-preview-05-20",
  "google/gemini-2.5-flash-preview-05-20:thinking",
  "google/gemini-2.5-pro-preview-05-06",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.7-sonnet:thinking",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "aion-labs/aion-1.0-mini",
  "qwen/qwen-vl-max",
  "openai/o3-mini",
  "deepseek/deepseek-r1-distill-qwen-1.5b",
  "deepseek/deepseek-r1-distill-qwen-32b",
  "deepseek/deepseek-r1-distill-qwen-14b",
  "deepseek/deepseek-r1-distill-llama-70b",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-chat-v3-0324",
  "deepseek/deepseek-chat",
  "anthropic/claude-3.5-sonnet",
  "x-ai/grok-3-beta",
  "x-ai/grok-3-mini-beta",
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4-scout",
  "qwen/qwq-32b",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4.5-preview",
  "google/gemini-2.0-flash-lite-001",
  "openai/o4-mini-high",
  "openai/o3",
  "openai/o4-mini",
  "deepseek/deepseek-r1-distill-llama-8b",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-sonnet"
];
// END: Allowed models list generated from models.json

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatId, userMessageContent, userId, model, webSearchEnabled, attachedFiles } = await req.json();

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

    // secret checks
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

    // Create new chat if chatId not provided
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

    // Save user's message to DB right away, with attachments if present, and with model
    const userMsgInsertPayload: any = {
      chat_id: currentChatId,
      user_id: userId,
      role: 'user',
      content: userMessageContent,
      model: model, // <----- ADDED
    };
    // If attachments from client exist, map and add them as metadata for DB
    if (attachedFiles && Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      userMsgInsertPayload.attachments = attachedFiles.map((f: any) => ({
        name: f.name,
        type: f.type,
        url: f.url,
      }));
    }
    const { error: userMessageError } = await supabaseAdmin
      .from('messages')
      .insert(userMsgInsertPayload);
    if (userMessageError) throw userMessageError;

    // Add to conversation history
    let messageContent: any[] = [{ type: "text", text: userMessageContent }];
    if (attachedFiles && Array.isArray(attachedFiles)) {
      for (const f of attachedFiles) {
        if (f.type.startsWith("image/")) {
          messageContent.push({
            type: "image_url",
            image_url: { url: f.url },
          });
        } else if (f.type === "application/pdf") {
          // Fetch, encode to base64 data URL
          try {
            const fileRes = await fetch(f.url);
            const fileBuf = new Uint8Array(await fileRes.arrayBuffer());
            const base64 = btoa(String.fromCharCode(...fileBuf));
            messageContent.push({
              type: "file",
              file: {
                filename: f.name,
                file_data: `data:application/pdf;base64,${base64}`,
              },
            });
          } catch (e) {
            console.error("Failed to fetch/encode PDF:", f.url, e);
          }
        }
      }
    }
    conversationHistory.push({ role: "user", content: messageContent });

    // Prepare OpenRouter API streaming call
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

    // Plugins for PDFs if any
    if (messageContent.some((x: any) => x.type === "file")) {
      body.plugins = [
        {
          id: "file-parser",
          pdf: { engine: "pdf-text" },
        },
      ];
    }

    // Start streaming from OpenRouter, proxying each chunk to the client as SSE in real-time.
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

    let assistantMessageContent = "";
    let reasoningContent = "";

    // Set up an SSE stream so the client receives data as soon as it's available
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const reader = openRouterResponse.body!.getReader();
            let done = false;
            let buffer = "";
            let inReasoning = false;

            // Send event for the new chatId (to sync on frontend if this is a new chat)
            controller.enqueue(encoder.encode(`event: chatId\ndata: ${currentChatId}\n\n`));

            while (!done) {
              const { value, done: doneReading } = await reader.read();
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                // Process complete lines
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
                        // You may choose to stream intermediate reasoning updates separately
                        controller.enqueue(encoder.encode(`event: reasoning\ndata: ${JSON.stringify({ reasoning: reasoningContent })}\n\n`));
                      }
                      if (parsed.choices?.[0]?.delta?.content !== undefined) {
                        inReasoning = false;
                        assistantMessageContent += parsed.choices[0].delta.content;
                        // Stream content as it comes in
                        controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`));
                      }
                    } catch {
                      // ignore JSON parse errors on partial data
                    }
                  }
                }
              }
              if (doneReading) done = true;
            }

            // After all streaming is done, signal completion with a combined payload
            const combinedPayload = JSON.stringify({
              content: assistantMessageContent,
              reasoning: reasoningContent,
            });

            controller.enqueue(encoder.encode(`event: done\ndata: ${combinedPayload}\n\n`));
            controller.close();

            // Persist to DB in the background (does not block user experience)
            supabaseAdmin
              .from('messages')
              .insert({
                chat_id: currentChatId,
                role: 'assistant',
                content: combinedPayload,
                model: body.model, // <----- ADDED
              })
              .then(({ error }) => {
                if (error) console.error('DB error saving assistant message:', error);
              });
          } catch (e) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e.message || "Internal error" })}\n\n`));
            controller.close();
          }
        },
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
  } catch (error) {
    console.error('Error in chat-handler function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
