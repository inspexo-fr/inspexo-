import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const missionId = formData.get("mission_id") as string;

    if (!file || !missionId) {
      return new Response(
        JSON.stringify({ error: "Fichier et mission_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Format accepté : JPG, PNG, WebP, PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Fichier trop volumineux (max 10 Mo)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Upload to Storage
    const fileName = `${missionId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("chat-files")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Erreur upload", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signed URL (1 hour)
    const { data: urlData } = await supabase.storage
      .from("chat-files")
      .createSignedUrl(fileName, 3600);

    // Save to chat_files table
    const { error: dbError } = await supabase
      .from("chat_files")
      .insert({
        mission_id: missionId,
        file_name: file.name,
        file_type: file.type,
        file_url: uploadData.path,
        file_size: file.size,
      });

    if (dbError) {
      console.error("DB error:", dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_name: file.name,
        file_url: urlData?.signedUrl || uploadData.path,
        file_type: file.type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
