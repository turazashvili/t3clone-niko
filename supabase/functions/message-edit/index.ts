
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { id, newContent } = await req.json();

    // Auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    const { data: { user }, error } = await supabaseClient.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ error: error?.message || "No user" }), { status: 401, headers: corsHeaders });
    }

    // Only allow user to edit their own user messages
    const { data: origMsg, error: getError } = await supabaseClient
      .from("messages")
      .select("id, user_id, role")
      .eq("id", id)
      .maybeSingle();

    if (getError || !origMsg || origMsg.role !== "user" || origMsg.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to edit this message." }), { status: 403, headers: corsHeaders });
    }

    // Update message
    const { error: updateErr } = await supabaseClient
      .from("messages")
      .update({ content: newContent })
      .eq("id", id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
