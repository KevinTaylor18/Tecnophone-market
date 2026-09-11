// Tecnophone Market — Edge Function del chat con IA.
//
// Recibe { message, history } del sitio, arma un prompt con el catálogo
// REAL de productos (leído en vivo desde la tabla "products"), se lo
// manda al proveedor de IA, y devuelve { reply } al navegador.
//
// La clave de la IA vive SOLO acá (como secret de Supabase), nunca en
// index.html ni en ningún archivo público.
//
// ⚠️ PUNTO DE AISLAMIENTO — proveedor de IA
// Toda la lógica específica de Gemini vive en callAiProvider(), más
// abajo. El día que quieras cambiar a la API de Claude (Anthropic):
//   1. Reescribís el CONTENIDO de callAiProvider() para llamar a la
//      API de Claude en vez de a Gemini.
//   2. Cambiás el nombre del secret (por ej. de GEMINI_API_KEY a
//      ANTHROPIC_API_KEY) con `supabase secrets set`.
// El resto de este archivo (CORS, lectura del catálogo, el manejo de
// errores) no necesita tocarse, y el sitio (index.html) tampoco: sigue
// llamando al mismo endpoint de siempre.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT_INTRO = `Sos el asistente virtual de Tecnophone Market, una tienda argentina de venta de iPhones nuevos y usados seleccionados, y otras marcas (Samsung, Xiaomi).

Cómo hablar: en español de Argentina, con "vos", tono cercano y directo, sin emojis. Respuestas cortas (2 a 4 oraciones), sin listas larguísimas.

Reglas importantes:
- Recomendá equipos SOLO de la lista de "Catálogo actual" de abajo. Nunca inventes un modelo, precio o color que no esté ahí.
- Si lo que piden no está en el catálogo, decilo con honestidad y sugerí escribir por WhatsApp para consultar disponibilidad o pedidos especiales.
- Todos los equipos tienen garantía de 60 días por escrito y pasaron un control de 32 puntos antes de la venta.
- Si preguntan algo que no tiene nada que ver con celulares o con la tienda, respondé breve igual pero encauzá la charla hacia cómo podés ayudarlos a elegir un equipo.
- Para cerrar una compra o coordinar cualquier cosa puntual (envío, forma de pago, entrega), sugerí siempre escribir por WhatsApp.`;

function formatPrice(n: number): string {
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchCatalogContext(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return "Catálogo actual: (no disponible en este momento).";
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/products?select=title,condition_label,color,current_price,original_price,installment_label,group_key&is_active=eq.true&order=sort_order.asc`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return "Catálogo actual: (no disponible en este momento).";

    const products = await res.json();
    if (!Array.isArray(products) || products.length === 0) {
      return "Catálogo actual: no hay equipos cargados en este momento.";
    }

    const lines = products.map((p: Record<string, unknown>) => {
      const parts: string[] = [String(p.title ?? "")];
      if (p.condition_label) parts.push(String(p.condition_label));
      if (p.color) parts.push("Color/es: " + String(p.color));
      let price = formatPrice(Number(p.current_price));
      if (p.original_price) price += ` (antes ${formatPrice(Number(p.original_price))})`;
      parts.push(price);
      if (p.installment_label) parts.push(String(p.installment_label));
      return "- " + parts.join(" · ");
    });

    return "Catálogo actual (precios en pesos argentinos):\n" + lines.join("\n");
  } catch (_err) {
    return "Catálogo actual: (no disponible en este momento).";
  }
}

type ChatMessage = { role: string; content: string };

class RateLimitedError extends Error {
  constructor() {
    super("rate_limited");
  }
}

/* ============================================================
   PUNTO DE AISLAMIENTO — proveedor de IA (hoy: Gemini)
   ============================================================ */
async function callAiProvider(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("missing_api_key");

  // Nombre del modelo de Gemini a usar. Se eligió la variante "lite":
  // no tiene razonamiento interno (respuestas más rápidas y baratas en
  // tokens) y el free tier le da límites de solicitudes por minuto más
  // generosos que a los modelos "flash" comunes. Si Google renombra o
  // retira este modelo, solo hay que cambiar esta línea.
  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = history
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({ role: m.role, parts: [{ text: m.content }] }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
  });

  // Este free tier a veces tiene picos de lentitud del lado de Google
  // (la mayoría de las respuestas tardan 1-3s, pero ocasionalmente
  // alguna se cuelga 20s o más). Le ponemos un techo por intento para
  // que el visitante nunca espere una eternidad: si se pasa, se corta
  // y el chat cae al mensaje de "probá por WhatsApp" en vez de colgarse.
  async function attempt(): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  let res: Response;
  try {
    res = await attempt();
  } catch (_e) {
    throw new Error("gemini_timeout");
  }

  // Gemini devuelve 503 cuando el modelo está saturado del lado de
  // Google — suele ser cuestión de segundos, así que probamos una vez
  // más antes de rendirnos (nunca reintentamos un 429: ese sí es
  // nuestro propio límite de cuota, reintentar no ayuda).
  if (res.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      res = await attempt();
    } catch (_e) {
      throw new Error("gemini_timeout_retry");
    }
  }

  if (res.status === 429) throw new RateLimitedError();
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gemini_error_${res.status}: ${text}`);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error("empty_reply");
  return String(reply).trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history.slice(-10) : [];

    if (!message) {
      return new Response(JSON.stringify({ error: "missing_message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catalogContext = await fetchCatalogContext();
    const systemPrompt = `${SYSTEM_PROMPT_INTRO}\n\n${catalogContext}`;

    const reply = await callAiProvider(systemPrompt, history, message);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[chat-assistant] Error:", err);

    if (err instanceof RateLimitedError) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          reply: "Estamos con muchas consultas en este momento. Escribinos directo por WhatsApp y te respondemos al toque.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        error: "internal_error",
        reply: "No pudimos procesar tu consulta ahora mismo. Probá de nuevo en un momento o escribinos por WhatsApp.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
