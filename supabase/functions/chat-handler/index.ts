import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Required for Supabase client

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // Use service role for DB operations

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

// --------- Helper: Save assistant stream progress -----------

async function upsertAssistantSession({
  supabaseAdmin,
  chat_id,
  user_id,
  streamed_content,
  streamed_reasoning,
  status = "streaming",
  session_id,
}) {
  // Upsert session (by id if provided, else by chat_id + user_id + streaming status)
  let upsertData = {
    chat_id,
    user_id,
    streamed_content,
    streamed_reasoning,
    status,
    last_chunk_at: new Date().toISOString(),
  };
  if (session_id) upsertData.id = session_id;

  const { data, error } = await supabaseAdmin
    .from("assistant_stream_sessions")
    .upsert([upsertData], { onConflict: "id" })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to upsert assistant_stream_sessions:", error);
  }
  return data;
}

async function updateAssistantSessionStatus({
  supabaseAdmin,
  session_id,
  status,
  message_id
}) {
  const updateData = { status };
  if (message_id) updateData.message_id = message_id;
  const { error } = await supabaseAdmin
    .from("assistant_stream_sessions")
    .update(updateData)
    .eq("id", session_id);
  if (error) {
    console.error("Failed to update assistant_stream_sessions status:", error);
  }
}

// ------------------------------------------------------------

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
      model: model,
    };
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

    // --- SYSTEM prompt ENHANCED for markdown ---
    let modelToUse = ALLOWED_MODELS.includes(model) ? model : "openai/o4-mini";
    let body: any = {
      model: modelToUse,
      messages: [
        {
          role: 'system',
          content:
            "You are a helpful assistant. All responses must be formatted with proper markdown. " +
            "ALWAYS use markdown for any lists, code, or inline technical content. " +
            "When sending code, ALWAYS use markdown code blocks with the correct language (e.g. ```js, ```python, etc). " +
            "Separate the reasoning (your train of thought, step-by-step technical breakdown) from the main answer if possible.",
        },
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
    if (messageContent.some((x: any) => x.type === "file")) {
      body.plugins = [
        {
          id: "file-parser",
          pdf: { engine: "pdf-text" },
        },
      ];
    }

    // --- Begin assistant streaming session record ---
    let streamSessionRow = await upsertAssistantSession({
      supabaseAdmin,
      chat_id: currentChatId,
      user_id: userId,
      streamed_content: "",
      streamed_reasoning: "",
      status: "streaming"
    });
    const assistantStreamSessionId = streamSessionRow?.id;
    if (!assistantStreamSessionId) {
      console.warn("Failed to create assistant_stream_sessions row - won't persist chunks incrementally.");
    }

    // Holders for stream progress
    let assistantMessageContent = "";
    let reasoningContent = "";

    // --- Streaming from OpenRouter ---
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

    // Set up an SSE stream so the client receives data as soon as it's available
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // -- Background persistence logic --
    async function persistStreamProgressPartial(content: string, reasoning: string) {
      if (!assistantStreamSessionId) return;
      await upsertAssistantSession({
        supabaseAdmin,
        chat_id: currentChatId,
        user_id: userId,
        streamed_content: content,
        streamed_reasoning: reasoning,
        session_id: assistantStreamSessionId,
        status: "streaming",
      });
    }

    // Function to mark session complete and write final message
    async function persistStreamFinal(content: string, reasoning: string) {
      if (!assistantStreamSessionId) return;
      // Save final session chunk
      await upsertAssistantSession({
        supabaseAdmin,
        chat_id: currentChatId,
        user_id: userId,
        streamed_content: content,
        streamed_reasoning: reasoning,
        session_id: assistantStreamSessionId,
        status: "completed",
      });
      // Insert final message into messages table
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({
          chat_id: currentChatId,
          role: 'assistant',
          content,
          reasoning,
          model: body.model,
        })
        .select()
        .single();
      if (error) {
        console.error("Error saving final assistant message to messages:", error);
      } else {
        // Attach the message_id to session row for reference
        await updateAssistantSessionStatus({
          supabaseAdmin,
          session_id: assistantStreamSessionId,
          status: "completed",
          message_id: data.id,
        });
      }
    }

    // Use this flag to buffer outgoing SSE to client, but background persist even if client disconnects
    let clientConnectionClosed = false;
    let lastPersistedLength = 0;
    let persistTimeout: number | undefined;

    // Write stream to client and persist to DB in the background
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const reader = openRouterResponse.body!.getReader();
            let done = false;
            let buffer = "";

            controller.enqueue(encoder.encode(`event: chatId\ndata: ${currentChatId}\n\n`));

            // Launch a background pinger that keeps saving progress at intervals (even after error/disconnect)
            function backgroundPersistLoop() {
              if (clientConnectionClosed) return;
              persistStreamProgressPartial(assistantMessageContent, reasoningContent);
              persistTimeout = setTimeout(backgroundPersistLoop, 1500);
            }
            backgroundPersistLoop();

            while (!done) {
              const { value, done: doneReading } = await reader.read();
              if (value) {
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
                      if (parsed.choices?.[0]?.delta?.reasoning !== undefined) {
                        reasoningContent += parsed.choices[0].delta.reasoning;
                        controller.enqueue(encoder.encode(`event: reasoning\ndata: ${JSON.stringify({ reasoning: reasoningContent })}\n\n`));
                        // Persist every ~800 chars of content chunk or on significant update
                        if (reasoningContent.length - lastPersistedLength > 800) {
                          lastPersistedLength = reasoningContent.length;
                          persistStreamProgressPartial(assistantMessageContent, reasoningContent);
                        }
                      }
                      if (parsed.choices?.[0]?.delta?.content !== undefined) {
                        assistantMessageContent += parsed.choices[0].delta.content;
                        controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`));
                        // Persist every ~800 chars of content chunk or on significant update
                        if (assistantMessageContent.length - lastPersistedLength > 800) {
                          lastPersistedLength = assistantMessageContent.length;
                          persistStreamProgressPartial(assistantMessageContent, reasoningContent);
                        }
                      }
                    } catch {
                      // ignore JSON parse errors
                    }
                  }
                }
              }
              if (doneReading) done = true;
            }

            // After all streaming is done, signal completion with a combined payload
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  content: assistantMessageContent,
                  reasoning: reasoningContent,
                })}\n\n`
              )
            );
            controller.close();
            clientConnectionClosed = true;
            if (persistTimeout) clearTimeout(persistTimeout);

            // Background save to DB on completion
            // Ensured to run even if client disconnects
            Deno.systemSync?.waitUntil?.(persistStreamFinal(assistantMessageContent, reasoningContent)) ||
              persistStreamFinal(assistantMessageContent, reasoningContent);
          } catch (e) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e.message || "Internal error" })}\n\n`));
            controller.close();
            clientConnectionClosed = true;
            if (persistTimeout) clearTimeout(persistTimeout);
            // Persist the last chunk as error
            Deno.systemSync?.waitUntil?.(
              upsertAssistantSession({
                supabaseAdmin,
                chat_id: currentChatId,
                user_id: userId,
                streamed_content: assistantMessageContent,
                streamed_reasoning: reasoningContent,
                session_id: assistantStreamSessionId,
                status: "error",
              })
            ) || upsertAssistantSession({
                supabaseAdmin,
                chat_id: currentChatId,
                user_id: userId,
                streamed_content: assistantMessageContent,
                streamed_reasoning: reasoningContent,
                session_id: assistantStreamSessionId,
                status: "error",
              });
          }
        },
        cancel() {
          // Invoked if client disconnects before stream ends
          clientConnectionClosed = true;
          if (persistTimeout) clearTimeout(persistTimeout);
          // Will still persist from the background loop above
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
  } catch (error) {
    console.error('Error in chat-handler function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
