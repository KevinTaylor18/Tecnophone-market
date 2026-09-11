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
// Toda la lógica específica del proveedor vive en callAiProvider(), más
// abajo. Hoy usa la API de Claude (Anthropic) — antes usaba Gemini. El
// día que quieras cambiar de proveedor de nuevo:
//   1. Reescribís el CONTENIDO de callAiProvider() para llamar a la API
//      del nuevo proveedor.
//   2. Cambiás el nombre del secret (hoy ANTHROPIC_API_KEY) con
//      `supabase secrets set`.
// El resto de este archivo (CORS, lectura del catálogo, el manejo de
// errores) no necesita tocarse, y el sitio (index.html) tampoco: sigue
// llamando al mismo endpoint de siempre, con el mismo formato de
// mensajes de siempre ({ role: "user" | "model", content }) — la
// conversión al formato que pida cada proveedor pasa acá adentro.

import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";

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
   PUNTO DE AISLAMIENTO — proveedor de IA (hoy: Claude / Anthropic)
   ============================================================ */
async function callAiProvider(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("missing_api_key");

  // Nombre del modelo de Claude a usar. Si Anthropic renombra o retira
  // este modelo, solo hay que cambiar esta línea.
  const model = "claude-sonnet-5";

  // Apagamos los reintentos automáticos del SDK: el manejo de 429/529 de
  // acá abajo replica a propósito la misma lógica que ya usábamos con
  // Gemini (un solo reintento ante saturación del proveedor, nunca ante
  // un 429 — ese es nuestro propio límite de cuota).
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  // Claude espera los mensajes como { role: "user" | "assistant", content }.
  // El resto del sistema (index.html, el historial que guarda el chat en
  // el navegador) sigue usando "model" para el rol del asistente —así se
  // armó cuando el proveedor era Gemini—, así que la traducción al
  // formato de Claude pasa acá adentro, sin tocar nada más.
  const messages: Anthropic.MessageParam[] = history
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m): Anthropic.MessageParam => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.content,
    }));
  messages.push({ role: "user", content: userMessage });

  // Dejamos el "thinking" adaptativo prendido (Claude Sonnet 5 lo corre
  // así por default) pero con esfuerzo "low": es la config recomendada
  // para chats cortos y sensibles a la latencia como este, en vez de la
  // config por default ("high") pensada para tareas de código/agentes.
  async function attempt(): Promise<Anthropic.Message> {
    return await client.messages.create(
      {
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
      },
      { timeout: 12000 }, // mismo techo de tiempo por intento que tenía Gemini
    );
  }

  let response: Anthropic.Message;
  try {
    response = await attempt();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new RateLimitedError();

    // Claude devuelve "overloaded_error" (HTTP 529) cuando está saturado
    // del lado de Anthropic — el equivalente al 503 que devolvía Gemini.
    // Suele ser cuestión de segundos, así que probamos una vez más antes
    // de rendirnos.
    if (err instanceof Anthropic.APIError && err.status === 529) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        response = await attempt();
      } catch (err2) {
        if (err2 instanceof Anthropic.RateLimitError) throw new RateLimitedError();
        throw new Error(`claude_error_retry: ${String(err2)}`);
      }
    } else if (err instanceof Anthropic.APIConnectionError) {
      // Se cortó por el timeout de 12s o por un problema de red — sin
      // reintento, igual que pasaba con Gemini.
      throw new Error("claude_timeout");
    } else {
      throw new Error(`claude_error: ${String(err)}`);
    }
  }

  let reply = "";
  for (const block of response.content) {
    if (block.type === "text") reply += block.text;
  }
  if (!reply) throw new Error("empty_reply");
  return reply.trim();
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
