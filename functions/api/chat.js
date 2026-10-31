// ============================================================================
// WARN ELECTRICAL SERVICES, SRL (WES)
// CLOUDFLARE PAGES FUNCTION: /api/chat
// Backend seguro para IA (Gemini / OpenAI) sin exponer credenciales al cliente
// Taller 3 - AIDET: Protección de secretos y custodia en servidor
// ============================================================================

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json().catch(() => ({}));
    const userMessage = (body.message || '').trim();

    if (!userMessage) {
      return new Response(JSON.stringify({ ok: false, error: 'Mensaje vacío' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Comprobar claves de servidor (Cloudflare Pages Environment Variables)
    const geminiKey = env.GEMINI_API_KEY || env.AI_API_KEY;
    const openaiKey = env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'API_KEY_NOT_CONFIGURED',
        message: 'Clave de IA no configurada en el servidor de Cloudflare Pages.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `Eres el Asistente Virtual Oficial de Warn Electrical Services, SRL (WES), ubicado en Moca, República Dominicana.
Especialidades WES:
- Motores para portones eléctricos (CAME BXV 400kg, 600kg, 800kg y 1000kg industriales).
- Laboratorio de inversores y bancos de baterías (Trace, Magnum, Outback).
- Cámaras de seguridad CCTV y control de acceso (Dahua, Hikvision, ZKTeco).
- Instalaciones y mantenimiento eléctrico general.
Reglas de respuesta:
1. Responde en español con tono cordial, profesional y de servicio.
2. Respuestas directas y concisas (máximo 2 a 3 párrafos).
3. Nunca inventes precios exactos ni estados de tickets confidenciales. Invita siempre a coordinar con el equipo comercial o pedir visita técnica.`;

    // 1. Si está configurado Gemini (Google AI Studio)
    if (geminiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nPregunta del cliente: ${userMessage}` }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 0.7
        }
      };

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (reply) {
        return new Response(JSON.stringify({ ok: true, provider: 'gemini', reply }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Si está configurado OpenAI
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 350,
          temperature: 0.7
        })
      });

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (reply) {
        return new Response(JSON.stringify({ ok: true, provider: 'openai', reply }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      ok: false,
      error: 'AI_PROVIDER_ERROR',
      message: 'No se obtuvo respuesta del proveedor de IA.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'SERVER_ERROR',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
