// ============================================================================
// WARN ELECTRICAL SERVICES, SRL (WES)
// ASISTENTE VIRTUAL Y CHAT ORIENTADO AL CLIENTE (TALLER 3 - AIDET)
// js/chat_cliente.js · Consultas públicas, estado de tickets y cotizaciones
// ============================================================================

(function() {
  'use strict';

  // Base de conocimientos técnicos y comerciales de WES
  const WES_KB = {
    empresa: {
      nombre: "Warn Electrical Services, SRL (WES)",
      ubicacion: "Moca, Provincia Espaillat, República Dominicana",
      horario: "Lunes a Viernes de 8:00 AM a 6:00 PM | Sábados de 8:00 AM a 1:00 PM",
      telefono: "(809) 578-0000",
      whatsapp: "18492075474",
      whatsappUrl: "https://wa.me/18492075474"
    },
    servicios: [
      {
        nombre: "Motores para Portones Eléctricos",
        detalle: "Instalación, mantenimiento y reparación de motores corredizos y batientes marca CAME (modelos BXV 400kg, 600kg, 800kg y 1000kg industriales). Garantía de repuestos y servicio técnico en Moca y todo el Cibao."
      },
      {
        nombre: "Sistemas de Inversores y Energía de Respaldo",
        detalle: "Diagnóstico en laboratorio, banco de pruebas, reparación de tarjetas electrónicas, cambio de componentes/ventiladores y mantenimiento para inversores Trace, Magnum y Outback, además de bancos de baterías AGM, Gel y Litio."
      },
      {
        nombre: "Cámaras de Seguridad CCTV y Alarmas",
        detalle: "Instalación de cámaras IP de alta definición Dahua y Hikvision, grabadores NVR/DVR, cableado estructurado y configuración de visualización remota en celulares mediante app DMSS."
      },
      {
        nombre: "Control de Acceso e Intercomunicadores",
        detalle: "Sistemas biométricos de huella y reconocimiento facial ZKTeco, tarjetas de proximidad, cerraduras electromagnéticas y videoporteros Dahua residenciales y comerciales."
      }
    ]
  };

  // Estado del flujo conversacional interactivo
  let chatSession = {
    isOpen: false,
    step: 'idle', // 'idle', 'awaiting_ticket_query', 'drafting_ticket'
    ticketDraft: {
      name: '',
      phone: '',
      equipment: '',
      address: '',
      description: ''
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicializar el widget de chat en la página
  function initClientChat() {
    renderChatLauncherAndModal();
    setupChatEvents();
  }

  function renderChatLauncherAndModal() {
    if (document.getElementById('wes-client-chat-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'wes-client-chat-wrapper';
    wrapper.innerHTML = `
      <!-- Botón Flotante Lanzador (Esquina Inferior Derecha) -->
      <div id="wes-chat-launcher" class="fixed bottom-6 right-6 z-40 flex items-center group cursor-pointer" onclick="toggleClientChat()" title="Chatear con el Asistente WES">
        <span class="hidden sm:inline-flex mr-2.5 px-3 py-1 bg-slate-900/90 text-wes-gold text-xs font-bold rounded-xl shadow-lg border border-wes-gold/40 backdrop-blur-xs transition group-hover:scale-105 pointer-events-none items-center space-x-1.5">
          <i class="fas fa-sparkles text-amber-400 text-[10px]"></i>
          <span>Asistente WES</span>
        </span>
        <button type="button" aria-label="Abrir Asistente Virtual WES" class="w-14 h-14 bg-gradient-to-tr from-slate-950 via-wes-blue to-slate-900 border-2 border-wes-gold text-wes-gold rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 relative focus:outline-none focus:ring-4 focus:ring-wes-gold/30">
          <i id="wes-chat-launcher-icon" class="fas fa-headset text-2xl transition-transform duration-300"></i>
          <span class="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs animate-pulse" title="Asistente en línea"></span>
        </button>
      </div>

      <!-- Ventana Flotante del Chat de Clientes -->
      <div id="wes-chat-modal" class="fixed bottom-6 right-4 sm:bottom-24 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[580px] max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex-col overflow-hidden hidden transition-all duration-300 animate-fadeIn text-slate-800 font-sans">
        
        <!-- Encabezado del Chat -->
        <div class="p-4 bg-gradient-to-r from-wes-dark via-wes-blue to-slate-900 text-white flex items-center justify-between shadow-md shrink-0">
          <div class="flex items-center space-x-3">
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-wes-gold text-slate-950 flex items-center justify-center font-black shadow-inner">
                <i class="fas fa-robot text-lg"></i>
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <h3 class="font-extrabold text-sm font-brand tracking-wide text-white">Asistente Virtual WES</h3>
                <span class="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-emerald-600/90 text-white rounded-md">En Línea</span>
              </div>
              <p class="text-[11px] text-slate-300">Warn Electrical Services · Soporte & Cotizaciones</p>
            </div>
          </div>
          <div class="flex items-center space-x-1">
            <button onclick="toggleClientChat()" type="button" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition focus:outline-none" title="Cerrar chat">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Área de Mensajes Desplazable -->
        <div id="wes-chat-messages" class="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/70 text-xs">
          <!-- Mensaje de Bienvenida Inicial -->
          <div class="flex items-start space-x-2">
            <div class="w-7 h-7 rounded-full bg-wes-blue text-wes-gold flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
              <i class="fas fa-robot"></i>
            </div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-xs max-w-[85%] leading-relaxed text-slate-800">
              <p class="font-bold text-slate-900 mb-1">¡Hola! 👋 Bienvenido a WES.</p>
              <p class="text-slate-600">Soy tu asistente virtual. Estoy aquí para ayudarte con:</p>
              <ul class="list-disc list-inside mt-1.5 space-y-1 text-slate-700">
                <li><strong>Consultar el estado</strong> de tu ticket o servicio técnico.</li>
                <li><strong>Información y cotizaciones</strong> de motores CAME, inversores o CCTV.</li>
                <li><strong>Reportar un problema</strong> y agendar soporte técnico.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Formulario de Entrada de Texto -->
        <form id="wes-chat-input-form" onsubmit="handleChatSubmit(event)" class="p-3 bg-white border-t border-slate-200 flex items-center space-x-2 shrink-0">
          <input type="text" id="wes-chat-user-input" placeholder="Escribe tu consulta o número de ticket..." autocomplete="off" class="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-wes-gold focus:bg-white transition shadow-inner">
          <button type="submit" class="w-10 h-10 bg-wes-blue hover:bg-wes-dark active:scale-95 text-wes-gold rounded-xl flex items-center justify-center transition shadow-md border border-wes-gold/40 shrink-0" title="Enviar mensaje">
            <i class="fas fa-paper-plane text-xs"></i>
          </button>
        </form>

        <!-- Pie de página sutil -->
        <div class="px-3 py-1 bg-slate-100 border-t border-slate-200/60 text-[9px] text-slate-500 flex items-center justify-between shrink-0">
          <span class="flex items-center space-x-1">
            <i class="fas fa-shield-alt text-emerald-600"></i>
            <span>Datos protegidos · Solo consultas públicas</span>
          </span>
          <a href="${WES_KB.empresa.whatsappUrl}" target="_blank" class="text-emerald-700 font-bold hover:underline flex items-center space-x-1">
            <i class="fab fa-whatsapp"></i>
            <span>Asesor Humano</span>
          </a>
        </div>

      </div>
    `;
    document.body.appendChild(wrapper);
  }

  function setupChatEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatSession.isOpen) {
        toggleClientChat();
      }
    });

    window.addEventListener('wes_ai_config_updated', (e) => {
      const wrapper = document.getElementById('wes-client-chat-wrapper');
      if (e.detail && e.detail.enabled === false) {
        if (wrapper) wrapper.classList.add('hidden');
      } else {
        if (!wrapper) {
          renderChatLauncherAndModal();
        } else {
          wrapper.classList.remove('hidden');
        }
      }
    });
  }

  // Abrir o cerrar la ventana de chat
  function toggleClientChat() {
    const modal = document.getElementById('wes-chat-modal');
    const icon = document.getElementById('wes-chat-launcher-icon');
    if (!modal) return;

    chatSession.isOpen = !chatSession.isOpen;

    if (chatSession.isOpen) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (icon) {
        icon.className = 'fas fa-chevron-down text-xl';
      }
      setTimeout(() => {
        document.getElementById('wes-chat-user-input')?.focus();
        scrollToBottom();
      }, 100);
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      if (icon) {
        icon.className = 'fas fa-headset text-2xl';
      }
    }
  }

  function scrollToBottom() {
    const msgContainer = document.getElementById('wes-chat-messages');
    if (msgContainer) {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }
  }

  function appendUserMessage(text) {
    const msgContainer = document.getElementById('wes-chat-messages');
    if (!msgContainer) return;

    const div = document.createElement('div');
    div.className = 'flex justify-end';
    div.innerHTML = `
      <div class="bg-wes-blue text-white px-3.5 py-2.5 rounded-2xl rounded-tr-none shadow-xs max-w-[85%] leading-relaxed text-xs">
        ${escapeHtml(text)}
      </div>
    `;
    msgContainer.appendChild(div);
    scrollToBottom();
  }

  function appendBotMessage(htmlContent) {
    const msgContainer = document.getElementById('wes-chat-messages');
    if (!msgContainer) return;

    const div = document.createElement('div');
    div.className = 'flex items-start space-x-2 animate-fadeIn';
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-wes-blue text-wes-gold flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
        <i class="fas fa-robot"></i>
      </div>
      <div class="bg-white p-3.5 rounded-2xl rounded-tl-none border border-slate-200/90 shadow-xs max-w-[88%] leading-relaxed text-slate-800 text-xs">
        ${htmlContent}
      </div>
    `;
    msgContainer.appendChild(div);
    scrollToBottom();
  }

  function appendTypingIndicator() {
    const msgContainer = document.getElementById('wes-chat-messages');
    if (!msgContainer) return null;

    const div = document.createElement('div');
    div.id = 'wes-chat-typing';
    div.className = 'flex items-start space-x-2 animate-fadeIn';
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-wes-blue text-wes-gold flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
        <i class="fas fa-robot animate-pulse"></i>
      </div>
      <div class="bg-white px-3.5 py-2.5 rounded-2xl rounded-tl-none border border-slate-200/90 shadow-xs text-slate-500 text-xs flex items-center space-x-1.5">
        <span class="w-1.5 h-1.5 bg-wes-gold rounded-full animate-bounce"></span>
        <span class="w-1.5 h-1.5 bg-wes-gold rounded-full animate-bounce [animation-delay:0.15s]"></span>
        <span class="w-1.5 h-1.5 bg-wes-gold rounded-full animate-bounce [animation-delay:0.3s]"></span>
        <span class="ml-1 text-[11px] text-slate-500 font-medium">Asistente WES consultando...</span>
      </div>
    `;
    msgContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('wes-chat-typing');
    if (el) el.remove();
  }

  const DEFAULT_SYSTEM_PROMPT = `Eres el Asistente Técnico y Asesor Comercial Oficial de Warn Electrical Services, SRL (WES). Atiendes a cada cliente en Moca y toda la República Dominicana con la misma calidez, seriedad, profesionalismo y vocación de servicio que el equipo fundador de la empresa (Luis Miguel Lizardo, Gerente General; Stephano Vásquez, Director de Ventas; y Yaneiry Díaz, Directora Administrativa).

Tu misión es representar fielmente a Warn Electrical Services: escuchar con atención la necesidad del cliente, asesorarlo con dominio técnico en nuestras soluciones, resolver sus dudas con empatía y orientarlo para solicitar una cotización, programar una visita técnica o ingresar su equipo a nuestro taller.

════════════════════════════════════════════════════════════════
1. IDENTIDAD CORPORATIVA & DATOS DE CONTACTO DE WES
════════════════════════════════════════════════════════════════
- Nombre de la Empresa: Warn Electrical Services, SRL (conocida como WES).
- Lema Corporativo: "Soluciones tecnológicas que protegen y conectan lo que más valoras."
- Sede Principal: Moca, Provincia Espaillat, República Dominicana.
- Cobertura Geográfica: Moca, Licey al Medio, Santiago, La Vega, Salcedo, San Francisco de Macorís y toda la región del Cibao (con capacidad para proyectos en todo el país).
- Teléfono Oficial de Oficina: (809) 578-0000.
- WhatsApp Directo de Ventas y Soporte: +1 (849) 207-5474 (enlace directo: https://wa.me/18492075474).
- Horarios de Operación: Lunes a Viernes de 8:00 AM a 6:00 PM | Sábados de 8:00 AM a 1:00 PM.
- Liderazgo de la Empresa:
  * Luis Miguel Lizardo: Fundador & Gerente General (Dirección estratégica e ingeniería).
  * Stephano Vásquez: Director de Ventas & Especialista en Servicio al Cliente (Atención personalizada).
  * Yaneiry Díaz: Directora Administrativa & Operaciones (Gestión financiera y calidad).

════════════════════════════════════════════════════════════════
2. CATÁLOGO COMPLETO DE SERVICIOS Y ESPECIALIDADES TÉCNICAS
════════════════════════════════════════════════════════════════
A. AUTOMATIZACIÓN DE PORTONES ELÉCTRICOS (ESPECIALISTAS CAME):
   - Distribuidores, instaladores y centro de servicio autorizado para motores italianos CAME.
   - Portones Corredizos: Motores CAME BXV (BXV 400 kg para portones residenciales ligeros, BXV 600 kg y 800 kg para uso residencial continuo y condominios, y BXV 1000 kg para portones industriales pesados).
   - Portones Batientes: Motores CAME Krono, ATI, Ferni y Fast (mecanismos de pistón electromecánico o brazo articulado para una o dos hojas).
   - Repuestos y Accesorios Originales en Inventario: Cremalleras de acero galvanizado para soldar o atornillar, fotoceldas de seguridad infrarrojas anti-aplastamiento (modelos DIR10 y Delta), tarjetas electrónicas de control (ZBX7N, ZLJ24), receptores de radiofrecuencia AF43S, controles remotos CAME TOP y SPACE de código seguro (Rolling Code 433.92 MHz) y cerraduras eléctricas de piso o electroimanes.
   - Servicios en Portones: Instalación desde cero, cambio de cremalleras desgastadas, reemplazo de finales de carrera, configuración de nuevos controles remotos, reparación de tarjetas quemadas por descargas eléctricas y mantenimiento preventivo.

B. LABORATORIO DE REPARACIÓN DE INVERSORES Y ENERGÍA DE RESPALDO:
   - Laboratorio técnico propio con banco de pruebas computarizado y personal especializado en electrónica de potencia.
   - Marcas atendidas y reparadas: Trace Engineering, Magnum Energy, Outback Power, Schneider Electric, Xantrex, Trojan y Forza.
   - Servicios de Laboratorio: Diagnóstico y reparación a nivel de tarjeta electrónica (cambio de transistores MOSFET de potencia, transformadores toroidales, relays de transferencia, diodos rectificadores, capacitores electrolíticos y ventiladores de enfriamiento forzado). Calibración precisa de voltaje de salida (120V/240V a 60 Hz) y corriente de carga.
   - Bancos de Baterías: Venta, instalación y mantenimiento de baterías Forza AGM de 12V 4.5Ah, 7Ah, 9Ah y baterías de ciclo profundo Trojan y Rolls Surrette (6V y 12V) y litio LiFePO4. Pruebas de descarga computarizada para evaluar la vida útil real de las baterías del cliente.

C. SEGURIDAD ELECTRÓNICA & CÁMARAS CCTV:
   - Diseño, cableado, instalación y configuración de sistemas de videovigilancia de alta definición.
   - Marcas líderes: Dahua Technology y Hikvision.
   - Tecnologías disponibles: Cámaras bala y domo Full HD y 4K Ultra HD, tecnología ColorVu y Full-Color (visión nocturna a todo color 24/7 sin perder detalles), cámaras con micrófono integrado y audio bidireccional, y detección inteligente de personas y vehículos mediante Inteligencia Artificial.
   - Grabadores y Almacenamiento: NVR y XVR de 4, 8, 16 y 32 canales con discos duros púrpura de grado videovigilancia continua (WD Purple).
   - Visualización Móvil: Configuración completa en los teléfonos del cliente (Android y iPhone) mediante la app DMSS sin mensualidades ni cargos ocultos.

D. CONTROL DE ACCESO, CITOFONÍA Y ELECTRICIDAD GENERAL:
   - Terminales biométricas de reconocimiento facial, huella dactilar y tarjetas de proximidad marca ZKTeco para control de personal y seguridad de condominios.
   - Cerraduras magnéticas (electroimanes) de 600 lbs y 1200 lbs con botón de salida No-Touch (sin contacto).
   - Videoporteros Dahua residenciales con cámara integrada y botón de apertura remota.
   - Cableado estructurado Cat6 100% cobre para redes de datos y cámaras IP.
   - Instalaciones eléctricas: Tableros de breakers, balanceo de cargas, interruptores de transferencia automática (ATS) para conmutación transparente entre CDEEE / EDE y planta eléctrica o inversor, y sistemas de puesta a tierra.

E. TALLER DE SERVICIO Y TABLERO KDS DE TICKETS:
   - Todo equipo que entra a nuestro taller recibe un ticket formal numerado (código SRV-YYYY-XXXX).
   - Diagnóstico técnico en 24 a 48 horas con presupuesto detallado antes de proceder.
   - El cliente puede consultar el estado de su ticket en cualquier momento desde esta web.
   - Garantía por escrito en repuestos y mano de obra.

════════════════════════════════════════════════════════════════
3. REGLAS DE ATENCIÓN Y COMPORTAMIENTO (COMO SI FUERAS EL DUEÑO)
════════════════════════════════════════════════════════════════
1. Habla en Primera Persona del Plural: Habla como miembro activo de Warn Electrical Services ("En WES le ofrecemos...", "Con gusto le coordinamos una visita...", "Nuestros técnicos en Moca...", "Para nosotros es un honor servirle...").
2. Calidez y Cortesía Dominicana: Saluda de forma entusiasta, respetuosa y profesional. Muestra disposición genuina de ayudar al cliente en todo momento.
3. Si el cliente pregunta "¿En qué me puede ayudar?", "¿Qué hacen?" o hace una consulta general:
   - Dale una bienvenida cordial y afectuosa a Warn Electrical Services (WES).
   - Explícale de forma ordenada y atractiva nuestras 4 soluciones clave (Motores CAME para portones, Taller de reparación de inversores y baterías, Cámaras de seguridad CCTV, y Controles de acceso/electricidad).
   - Hazle una pregunta de cierre cordial para conocer su caso: "¿Tiene en mente algún proyecto en particular o requiere asistencia técnica para algún equipo en su hogar o negocio?".
4. Precios y Cotizaciones:
   - Nunca inventes un precio cerrado sin conocer los datos del proyecto.
   - Explica con transparencia que en WES cada instalación se calcula a la medida para garantizar que el equipo sea el adecuado y dure muchos años (por ejemplo: el motor depende del peso y uso del portón; las cámaras, de la cantidad de áreas y distancias; los inversores, de la carga eléctrica).
   - Invítalo amablemente a cotizar sin costo ni compromiso enviándonos fotos o detalles a nuestro WhatsApp (849) 207-5474 o solicitando una visita técnica en sitio.
5. Reporte de Averías o Reparaciones:
   - Si el cliente dice que un motor, inversor o cámara no funciona, escúchalo con empatía, pídele detalles del síntoma (marca, modelo, qué hace o qué no hace) y dile que con gusto nuestros técnicos en Moca pueden revisarlo a fondo en nuestro laboratorio o agendar una revisión en su domicilio.
6. Formato de Respuesta:
   - Estructura las respuestas con viñetas limpias, buena puntuación y emojis sobrios y profesionales.
   - Entrega SIEMPRE respuestas completas, fluidas y bien redactadas. Jamás cortes una respuesta a la mitad.`;

  async function queryAIBackend(userMessage) {
    // 1. Obtener configuración de IA guardada por el administrador en wes_ai_config (Taller 3)
    let aiConfig = null;
    try {
      const stored = localStorage.getItem('wes_ai_config');
      if (stored) {
        aiConfig = JSON.parse(stored);
      }
    } catch (e) {}

    // Si el administrador desactivó el asistente explícitamente:
    if (aiConfig && aiConfig.enabled === false) {
      return null;
    }

    // 2. Si el administrador configuró una API Key (Google Gemini u OpenAI)
    if (aiConfig && aiConfig.apiKey && aiConfig.apiKey.length > 5) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 14000); // 14s timeout
        const provider = aiConfig.provider || 'gemini';
        let preferredModel = aiConfig.model || (provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini');
        if (preferredModel === 'gemini-1.5-flash' || preferredModel === 'gemini-2.5-flash' || preferredModel === 'gemini-3.8-flash') {
          preferredModel = 'gemini-2.0-flash';
        }

        // Si el prompt guardado es breve o versión vieja, usar el prompt empresarial 3.0
        const rawPrompt = aiConfig.systemPrompt || '';
        const systemPrompt = (rawPrompt.length > 500) ? rawPrompt : DEFAULT_SYSTEM_PROMPT;
        const temperature = aiConfig.temperature !== undefined ? Number(aiConfig.temperature) : 0.7;
        const maxTokens = Math.max(Number(aiConfig.maxTokens) || 800, 800);

        let reply = '';

        if (provider === 'gemini') {
          const candidateModels = [
            preferredModel,
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash-latest',
            'gemini-3.5-flash',
            'gemini-2.0-flash-exp',
            'gemini-3.8-flash'
          ].filter((val, idx, self) => val && self.indexOf(val) === idx);

          for (const candidate of candidateModels) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${aiConfig.apiKey}`;
              
              // Intentar primero con systemInstruction oficial de Gemini
              let res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  systemInstruction: {
                    parts: [{ text: systemPrompt }]
                  },
                  contents: [{
                    role: 'user',
                    parts: [{ text: userMessage }]
                  }],
                  generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: temperature
                  }
                }),
                signal: controller.signal
              });

              // Si falla por payload systemInstruction, reintentar con contents unificado
              if (!res.ok) {
                res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [{ text: `[INSTRUCCIONES DEL SISTEMA DE WES]\n${systemPrompt}\n\n[CONSULTA DEL CLIENTE]\n${userMessage}` }]
                    }],
                    generationConfig: {
                      maxOutputTokens: maxTokens,
                      temperature: temperature
                    }
                  }),
                  signal: controller.signal
                });
              }

              if (res.ok) {
                const data = await res.json();
                const candidateObj = data?.candidates?.[0];
                const parts = candidateObj?.content?.parts || [];
                // Concatenar TODAS las partes para evitar truncamiento
                reply = parts.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();
                
                if (reply) {
                  if (candidate !== aiConfig.model) {
                    aiConfig.model = candidate;
                    try { localStorage.setItem('wes_ai_config', JSON.stringify(aiConfig)); } catch (e) {}
                  }
                  break;
                }
              } else {
                console.warn(`[Client Chat Cascade] Modelo ${candidate} no disponible, probando alternativo...`);
              }
            } catch (candErr) {
              if (controller.signal.aborted) break;
            }
          }
          clearTimeout(timeoutId);
        } else if (provider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
              model: preferredModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
              ],
              max_tokens: maxTokens,
              temperature: temperature
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            reply = data?.choices?.[0]?.message?.content || '';
          }
        }

        if (reply && reply.trim()) {
          return { ok: true, reply: reply.trim(), provider };
        }
      } catch (err) {
        console.warn('[WES Chat] Error consultando API de IA:', err);
      }
    }

    // 3. Fallback a endpoint local /api/chat si estuviese activo
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.reply) {
          return data;
        }
      }
    } catch (e) {}

    return null;
  }

  // Manejar clics de los chips de sugerencia rápida
  function handleQuickChipClick(topic) {
    if (topic === 'ticket') {
      appendUserMessage('Quiero consultar el estado de mi ticket.');
      chatSession.step = 'awaiting_ticket_query';
      appendBotMessage(`
        <p class="font-bold text-slate-900 mb-1">🔍 Consulta de Estado de Servicio</p>
        <p class="text-slate-600 mb-2">Por favor escribe el <strong>código de tu ticket</strong> (ejemplo: <code>SRV-2026-0001</code> o solo <code>0001</code>), o tu número de teléfono registrado:</p>
        <div class="flex flex-wrap gap-1.5 pt-1">
          <button type="button" onclick="querySpecificTicket('SRV-2026-0001')" class="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-700 rounded-md text-[10px] font-mono">SRV-2026-0001</button>
          <button type="button" onclick="querySpecificTicket('SRV-2026-0002')" class="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-700 rounded-md text-[10px] font-mono">SRV-2026-0002</button>
        </div>
      `);
    } else if (topic === 'motores') {
      appendUserMessage('¿Qué opciones de motores para portones tienen?');
      appendBotMessage(`
        <p class="font-bold text-slate-900 mb-1">⚡ Motores para Portones Eléctricos CAME</p>
        <p class="text-slate-600 mb-2">${WES_KB.servicios[0].detalle}</p>
        <div class="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-slate-700 mb-2">
          <div>• <strong>CAME BXV 400kg / 600kg:</strong> Residencial rápido y silencioso.</div>
          <div>• <strong>CAME BXV 800kg / 1000kg:</strong> Alto tráfico y condominios.</div>
        </div>
        <a href="${WES_KB.empresa.whatsappUrl}?text=${encodeURIComponent('Hola WES, deseo información y cotización para motor de portón CAME.')}" target="_blank" class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition shadow-xs">
          <i class="fab fa-whatsapp"></i>
          <span>Cotizar Motor por WhatsApp</span>
        </a>
      `);
    } else if (topic === 'inversores') {
      appendUserMessage('¿Dan mantenimiento a inversores en laboratorio?');
      appendBotMessage(`
        <p class="font-bold text-slate-900 mb-1">🔋 Laboratorio Especializado de Inversores WES</p>
        <p class="text-slate-600 mb-2">${WES_KB.servicios[1].detalle}</p>
        <p class="text-slate-600 mb-2">Contamos con banco de pruebas y técnicos certificados para marcas como <strong>Trace Engineering, Magnum Energy y Outback</strong>.</p>
        <button type="button" onclick="startServiceRequestFlow('Inversor')" class="px-3 py-1.5 bg-wes-blue hover:bg-wes-dark text-white rounded-xl font-bold text-xs transition border border-wes-gold/40">
          <i class="fas fa-wrench mr-1 text-wes-gold"></i> Solicitar Revisión de Inversor
        </button>
      `);
    } else if (topic === 'horarios') {
      appendUserMessage('¿Cuáles son los horarios y ubicación del taller WES?');
      appendBotMessage(`
        <p class="font-bold text-slate-900 mb-1">📍 Warn Electrical Services, SRL</p>
        <p class="text-slate-700 mb-1.5"><strong>Dirección:</strong> ${WES_KB.empresa.ubicacion}</p>
        <p class="text-slate-700 mb-2"><strong>Horario de Atención:</strong><br>${WES_KB.empresa.horario}</p>
        <p class="text-slate-600 mb-3">Brindamos cobertura directa para Moca, Santiago, Licey, Salcedo, La Vega y toda la región del Cibao.</p>
        <a href="#contacto" onclick="toggleClientChat()" class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition">
          <i class="fas fa-map-marked-alt text-wes-gold"></i>
          <span>Ver Mapa en la Página</span>
        </a>
      `);
    } else if (topic === 'soporte') {
      appendUserMessage('Necesito solicitar un servicio técnico.');
      startServiceRequestFlow();
    }
  }

  // Buscar un ticket y mostrar ÚNICAMENTE información pública para el cliente (Taller 3 Security & Privacy)
  function findTicketPublicStatus(query) {
    if (!query || !query.trim()) return null;
    const cleanQuery = query.trim().toUpperCase();

    if (typeof KDSService === 'undefined' || typeof KDSService.getServices !== 'function') {
      return null;
    }

    const services = KDSService.getServices();
    const digitsOnly = cleanQuery.replace(/\D/g, '');

    const match = services.find(s => {
      const sId = (s.id || '').toUpperCase();
      const sPhone = (s.phone || '').replace(/\D/g, '');
      const sClient = (s.clientName || '').toUpperCase();

      if (sId === cleanQuery) return true;
      if (cleanQuery.length >= 4 && sId.includes(cleanQuery)) return true;
      if (digitsOnly.length >= 4 && sId.endsWith(digitsOnly)) return true;
      if (digitsOnly.length >= 7 && sPhone.includes(digitsOnly)) return true;
      if (cleanQuery.length >= 4 && sClient.includes(cleanQuery)) return true;
      return false;
    });

    return match || null;
  }

  function querySpecificTicket(ticketCode) {
    appendUserMessage(`Consultar ticket ${ticketCode}`);
    executeTicketSearch(ticketCode);
  }

  function executeTicketSearch(query) {
    const ticket = findTicketPublicStatus(query);

    if (!ticket) {
      appendBotMessage(`
        <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 mb-2">
          <div class="flex items-center space-x-1.5 font-bold mb-1">
            <i class="fas fa-exclamation-circle text-rose-600"></i>
            <span>No se encontró ningún ticket con esa referencia</span>
          </div>
          <p class="text-[11px] text-rose-700">Verifica el número de orden (ej. <code>SRV-2026-0001</code>) o el teléfono con el que fue registrado.</p>
        </div>
        <p class="text-slate-600">¿Deseas que un técnico de recepción te asista directamente?</p>
        <div class="pt-2 flex items-center space-x-2">
          <a href="${WES_KB.empresa.whatsappUrl}?text=${encodeURIComponent('Hola WES, quisiera consultar el estatus de mi orden pero no tengo a mano el código exacto.')}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition inline-flex items-center space-x-1">
            <i class="fab fa-whatsapp"></i>
            <span>Consultar por WhatsApp</span>
          </a>
        </div>
      `);
      return;
    }

    const state = typeof KDSService !== 'undefined' ? KDSService.calculateTimeState(ticket) : { label: ticket.status || 'En Proceso' };
    const dateFormatted = typeof KDSService !== 'undefined' ? KDSService.formatShortDate(ticket.createdAt || ticket.date) : 'Reciente';

    // Regla de Seguridad Taller 3: Aislamiento estricto de notas de laboratorio internas.
    // Solo se muestra el estatus general y confirmación pública.
    let statusBadgeClass = 'bg-blue-600 text-white';
    let statusText = ticket.status || 'En Atención';

    if (ticket.status === 'Terminado' || ticket.status === 'Resuelto') {
      statusBadgeClass = 'bg-emerald-600 text-white';
      statusText = 'Listo / Terminado para Entrega';
    } else if (ticket.status === 'En laboratorio') {
      statusBadgeClass = 'bg-amber-500 text-slate-950 font-bold';
      statusText = 'En Laboratorio Técnico (En Pruebas)';
    } else if (ticket.status === 'En reparación') {
      statusBadgeClass = 'bg-indigo-600 text-white';
      statusText = 'En Reparación / Mantenimiento';
    } else if (ticket.status === 'Nuevo') {
      statusBadgeClass = 'bg-emerald-600 text-white';
      statusText = 'Ingresado / En Cola de Atención';
    }

    appendBotMessage(`
      <div class="p-3 bg-white rounded-xl border-2 border-wes-gold/50 shadow-sm space-y-2">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
          <span class="font-mono font-black text-wes-blue text-xs tracking-wider">${escapeHtml(ticket.id)}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${statusBadgeClass}">
            ${escapeHtml(statusText)}
          </span>
        </div>
        <div class="space-y-1 text-slate-700">
          <div><span class="text-slate-400 font-bold">Cliente:</span> <strong>${escapeHtml(ticket.clientName)}</strong></div>
          <div><span class="text-slate-400 font-bold">Equipo:</span> <strong>${escapeHtml(ticket.productSystem || 'Servicio Técnico')}</strong></div>
          <div><span class="text-slate-400 font-bold">Ubicación:</span> ${escapeHtml(ticket.address || 'Taller WES Moca')}</div>
          <div><span class="text-slate-400 font-bold">Fecha de Ingreso:</span> ${escapeHtml(dateFormatted)}</div>
        </div>
        <div class="p-2 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-600">
          <span class="font-bold text-slate-800 block mb-0.5"><i class="fas fa-info-circle text-amber-500 mr-1"></i>Información al Cliente:</span>
          ${escapeHtml(ticket.description || 'Su equipo se encuentra en proceso de atención técnica por el equipo de WES.')}
        </div>
        <div class="pt-1 flex items-center justify-between text-[10px]">
          <span class="text-slate-400 font-medium">Prioridad: <strong>${escapeHtml(ticket.priority || 'Normal')}</strong></span>
          <a href="${WES_KB.empresa.whatsappUrl}?text=${encodeURIComponent(`Hola WES, estoy consultando mi orden ${ticket.id} (${ticket.clientName}) y quisiera una actualización.`)}" target="_blank" class="text-emerald-700 font-bold hover:underline flex items-center space-x-1">
            <i class="fab fa-whatsapp"></i>
            <span>Hablar con el Taller</span>
          </a>
        </div>
      </div>
    `);

    chatSession.step = 'idle';
  }

  // Flujo Human-in-the-Loop para generar una solicitud de soporte asistida (Taller 3)
  function startServiceRequestFlow(presetEquipment = '') {
    chatSession.step = 'drafting_ticket';
    chatSession.ticketDraft = {
      name: '',
      phone: '',
      equipment: presetEquipment || '',
      address: '',
      description: ''
    };

    appendBotMessage(`
      <p class="font-bold text-slate-900 mb-1">🛠️ Registro Asistido de Solicitud Técnica</p>
      <p class="text-slate-600 mb-2">Con gusto preparamos tu solicitud. Para ingresar tu orden directamente a nuestro sistema, por favor indícame:</p>
      <div class="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-950 space-y-1 mb-2">
        <div>1. <strong>Tu Nombre Completo</strong></div>
        <div>2. <strong>Tu Teléfono o WhatsApp</strong></div>
        <div>3. <strong>Equipo y Falla</strong> que presenta</div>
      </div>
      <p class="text-[11px] text-slate-500">Puedes escribirlo todo en un solo mensaje. Ejemplo:<br><em>"Carlos Peña, 809-578-1234, Moca, mi inversor Trace no enciende."</em></p>
    `);
  }

  function handleDraftParsing(text) {
    // Extracción inteligente de datos
    const phoneMatch = text.match(/(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/);
    const phone = phoneMatch ? phoneMatch[0] : '';

    // Separar posibles partes
    const parts = text.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    let name = parts[0] || 'Cliente Web';
    if (phone && name.includes(phone)) {
      name = 'Cliente WES';
    }

    const description = text;

    chatSession.ticketDraft.name = name;
    chatSession.ticketDraft.phone = phone || '(809) ';
    chatSession.ticketDraft.address = 'Moca, Rep. Dominicana';
    chatSession.ticketDraft.equipment = chatSession.ticketDraft.equipment || 'Revisión Técnica General';
    chatSession.ticketDraft.description = description;

    // Presentar borrador con Human-in-the-Loop para confirmación antes de guardar
    appendBotMessage(`
      <div class="p-3 bg-white rounded-xl border border-amber-300 shadow-sm space-y-2">
        <div class="flex items-center space-x-1.5 font-bold text-amber-900 text-xs border-b border-amber-100 pb-1.5">
          <i class="fas fa-clipboard-check text-amber-600"></i>
          <span>Borrador de Solicitud de Servicio Técnico</span>
        </div>
        <p class="text-[11px] text-slate-600">Por favor confirma los datos antes de ingresarlo al sistema:</p>
        <div class="space-y-1 text-slate-700 text-xs">
          <div><span class="text-slate-400 font-bold">Cliente:</span> <strong>${escapeHtml(chatSession.ticketDraft.name)}</strong></div>
          <div><span class="text-slate-400 font-bold">Teléfono:</span> <strong>${escapeHtml(chatSession.ticketDraft.phone)}</strong></div>
          <div><span class="text-slate-400 font-bold">Detalle del requerimiento:</span> ${escapeHtml(chatSession.ticketDraft.description)}</div>
        </div>
        <div class="pt-2 flex items-center space-x-2">
          <button type="button" onclick="confirmTicketDraft()" class="flex-1 py-2 bg-wes-blue hover:bg-wes-dark text-white rounded-xl font-bold text-xs transition shadow-xs flex items-center justify-center space-x-1 border border-wes-gold/40">
            <i class="fas fa-check text-wes-gold"></i>
            <span>Confirmar e Ingresar Ticket</span>
          </button>
          <button type="button" onclick="cancelTicketDraft()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition">
            Cancelar
          </button>
        </div>
      </div>
    `);
  }

  function confirmTicketDraft() {
    if (typeof KDSService === 'undefined' || typeof KDSService.createService !== 'function') {
      appendBotMessage(`
        <p class="text-rose-600 font-bold">No fue posible conectar con el sistema de órdenes en este momento.</p>
        <p class="text-slate-600">Por favor comunícate directamente por WhatsApp al <a href="${WES_KB.empresa.whatsappUrl}" class="text-emerald-600 font-bold">${WES_KB.empresa.telefono}</a>.</p>
      `);
      return;
    }

    const draft = chatSession.ticketDraft;
    const res = KDSService.createService({
      clientName: draft.name || 'Cliente WES',
      phone: draft.phone && draft.phone.length > 5 ? draft.phone : '(809) 578-0000',
      productSystem: draft.equipment || 'Servicio Técnico Solicitado',
      address: draft.address || 'Moca, Rep. Dominicana',
      description: draft.description || 'Solicitud generada desde el Asistente Virtual Web.',
      priority: 'Normal'
    });

    if (res.success) {
      appendBotMessage(`
        <div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 space-y-2">
          <div class="flex items-center space-x-1.5 font-black text-emerald-800 text-xs">
            <i class="fas fa-check-circle text-emerald-600 text-sm"></i>
            <span>¡Solicitud Registrada Exitosamente!</span>
          </div>
          <p class="text-xs">Tu orden ha sido ingresada en tiempo real al tablero de nuestros técnicos de taller con el código:</p>
          <div class="p-2 bg-white rounded-lg border border-emerald-200 text-center font-mono font-black text-sm text-wes-blue">
            ${escapeHtml(res.service.id)}
          </div>
          <p class="text-[11px] text-emerald-800">Un técnico de WES se pondrá en contacto contigo a la brevedad para coordinar la revisión.</p>
        </div>
      `);
      chatSession.step = 'idle';
      chatSession.ticketDraft = {};
    } else {
      appendBotMessage(`
        <p class="text-rose-600 font-bold">${escapeHtml(res.message || 'Error al guardar la solicitud')}</p>
      `);
    }
  }

  function cancelTicketDraft() {
    chatSession.step = 'idle';
    chatSession.ticketDraft = {};
    appendBotMessage('<p class="text-slate-600">Solicitud cancelada. ¿En qué más te puedo asistir?</p>');
  }

  // Procesamiento principal de mensajes enviados por el usuario
  async function handleChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('wes-chat-user-input');
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    input.value = '';
    appendUserMessage(query);

    // 1. Si estábamos esperando el código del ticket
    if (chatSession.step === 'awaiting_ticket_query') {
      executeTicketSearch(query);
      return;
    }

    // 2. Si estábamos en el flujo de borrador de ticket
    if (chatSession.step === 'drafting_ticket') {
      handleDraftParsing(query);
      return;
    }

    const lower = query.toLowerCase();

    // 3. Detección automática si el usuario escribió un código de ticket directamente
    if (/^(SRV|TKT|\d{4})/i.test(query) || (lower.includes('srv-') && lower.match(/srv-\d{4}-\d{4}/i))) {
      executeTicketSearch(query);
      return;
    }

    // 4. Saludos
    if (/(hola|buenos d|buenas t|buenas n|saludos|hey|klk)/i.test(lower)) {
      appendBotMessage(`
        <p>¡Hola! Un placer saludarte. Soy el Asistente de <strong>Warn Electrical Services (WES)</strong> en Moca.</p>
        <p class="text-slate-600 mt-1">¿Deseas consultar un ticket técnico, cotizar un motor de portón, o pedir información de inversores y cámaras?</p>
      `);
      return;
    }

    // 5. Intención de consultar ticket
    if (/(ticket|estatus|estado|mi orden|como va|reparacion|mi equipo)/i.test(lower)) {
      chatSession.step = 'awaiting_ticket_query';
      appendBotMessage(`
        <p class="font-bold text-slate-900 mb-1">🔍 Consulta de Ticket Técnico</p>
        <p class="text-slate-600">Por favor indícame el <strong>código de tu ticket</strong> (ej. <code>SRV-2026-0001</code>) o tu número de teléfono registrado:</p>
      `);
      return;
    }

    // 6. Intención de motores o portones
    if (/(motor|porton|came|corredizo|batiente|bxv|cremallera)/i.test(lower)) {
      handleQuickChipClick('motores');
      return;
    }

    // 7. Intención de inversores o energía
    if (/(inversor|bateria|trace|magnum|outback|energia|planta|solar)/i.test(lower)) {
      handleQuickChipClick('inversores');
      return;
    }

    // 8. Intención de cámaras, CCTV o alarmas
    if (/(camara|cctv|dahua|hikvision|alarma|sensor|nvr|dvr)/i.test(lower)) {
      appendBotMessage(`
        <p class="font-bold text-slate-900 mb-1">📹 Seguridad Electrónica & Cámaras CCTV</p>
        <p class="text-slate-600 mb-2">${WES_KB.servicios[2].detalle}</p>
        <p class="text-slate-600 mb-2">Instalamos kits completos con acceso en vivo desde tu teléfono Android o iPhone en cualquier parte del mundo.</p>
        <a href="${WES_KB.empresa.whatsappUrl}?text=${encodeURIComponent('Hola WES, quisiera cotizar una instalación de cámaras de seguridad.')}" target="_blank" class="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition">
          <i class="fab fa-whatsapp"></i>
          <span>Cotizar Sistema CCTV</span>
        </a>
      `);
      return;
    }

    // 9. Horarios o ubicación
    if (/(horario|donde estan|ubicacion|direccion|moca|abierto|telefono|contacto)/i.test(lower)) {
      handleQuickChipClick('horarios');
      return;
    }

    // 10. Solicitud de nuevo servicio o reparación
    if (/(reparar|arreglar|falla|dañado|no prende|no abre|mantenimiento|servicio)/i.test(lower)) {
      startServiceRequestFlow();
      return;
    }

    // Consultar al backend de IA (Cloudflare Pages Function /api/chat)
    appendTypingIndicator();
    const aiResult = await queryAIBackend(query);
    removeTypingIndicator();

    if (aiResult && aiResult.ok && aiResult.reply) {
      appendBotMessage(`
        <div class="space-y-2">
          <div class="flex items-center space-x-1.5 text-[10px] text-amber-700 font-bold uppercase tracking-wider mb-1">
            <i class="fas fa-sparkles text-amber-500"></i>
            <span>Respuesta Asistente WES IA</span>
          </div>
          <div class="leading-relaxed text-slate-800">
            ${escapeHtml(aiResult.reply).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}
          </div>
          <div class="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
            <a href="${WES_KB.empresa.whatsappUrl}?text=${encodeURIComponent(`Hola WES, el asistente virtual me sugirió: ${aiResult.reply.substring(0, 100)}...`)}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition inline-flex items-center space-x-1 shadow-xs">
              <i class="fab fa-whatsapp"></i>
              <span>Hablar con un Asesor</span>
            </a>
            <button type="button" onclick="startServiceRequestFlow()" class="px-3 py-1.5 bg-wes-blue hover:bg-wes-dark text-white rounded-xl font-bold text-xs transition border border-wes-gold/40">
              <i class="fas fa-tools text-wes-gold mr-1"></i> Abrir Solicitud
            </button>
          </div>
        </div>
      `);
      return;
    }

    // Respuesta general inteligente y corporativa por defecto de WES
    appendBotMessage(`
      <div class="space-y-3">
        <div class="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs space-y-2">
          <p class="font-bold text-slate-900">
            ¡Hola! Es un placer saludarle de parte de <strong>Warn Electrical Services, SRL (WES)</strong> en Moca.
          </p>
          <p class="text-slate-600 leading-relaxed">
            Somos especialistas líderes en automatización, seguridad electrónica y energía ininterrumpida para hogares, fincas y empresas en todo el Cibao. Estamos para servirle en:
          </p>
          <div class="space-y-1.5 pt-1 text-slate-800">
            <div class="flex items-start space-x-2">
              <i class="fas fa-door-open text-amber-500 mt-0.5 shrink-0"></i>
              <div><strong>Motores para Portones CAME:</strong> Instalación, repuestos (cremalleras, fotoceldas, controles) y reparación de modelos corredizos BXV (400kg a 1000kg) y batientes.</div>
            </div>
            <div class="flex items-start space-x-2">
              <i class="fas fa-car-battery text-emerald-600 mt-0.5 shrink-0"></i>
              <div><strong>Laboratorio de Inversores & Baterías:</strong> Reparación de tarjetas electrónicas Trace, Magnum y Outback, además de bancos de baterías Forza AGM, Trojan y Litio.</div>
            </div>
            <div class="flex items-start space-x-2">
              <i class="fas fa-video text-blue-600 mt-0.5 shrink-0"></i>
              <div><strong>Cámaras de Seguridad CCTV:</strong> Sistemas Dahua y Hikvision con visión a color nocturna ColorVu y monitoreo en vivo en tu celular con app DMSS.</div>
            </div>
            <div class="flex items-start space-x-2">
              <i class="fas fa-tools text-purple-600 mt-0.5 shrink-0"></i>
              <div><strong>Taller Técnico y Diagnóstico:</strong> Recepción con ticket formal SRV en 24 a 48 horas y garantía formal por escrito.</div>
            </div>
          </div>
        </div>
        <p class="text-slate-600 text-xs">
          ¿En cuál de estas soluciones podemos asistirle hoy? Puede escribirnos su consulta directamente o contactar a uno de nuestros asesores:
        </p>
        <div class="pt-1 flex flex-wrap gap-2">
          <a href="${WES_KB.empresa.whatsappUrl}?text=${encodeURIComponent(`Hola WES, estoy en la página web y quisiera una cotización/asesoría sobre: ${query}`)}" target="_blank" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition inline-flex items-center space-x-1.5 shadow-xs">
            <i class="fab fa-whatsapp text-sm"></i>
            <span>Hablar con un Asesor al (849) 207-5474</span>
          </a>
          <button type="button" onclick="startServiceRequestFlow()" class="px-3.5 py-2 bg-wes-blue hover:bg-wes-dark text-white rounded-xl font-bold text-xs transition border border-wes-gold/40">
            <i class="fas fa-tools text-wes-gold mr-1"></i> Abrir Solicitud Técnica
          </button>
        </div>
      </div>
    `);
  }

  // Exportar funciones a window para interacción con el DOM
  if (typeof window !== 'undefined') {
    window.toggleClientChat = toggleClientChat;
    window.handleQuickChipClick = handleQuickChipClick;
    window.handleChatSubmit = handleChatSubmit;
    window.querySpecificTicket = querySpecificTicket;
    window.startServiceRequestFlow = startServiceRequestFlow;
    window.confirmTicketDraft = confirmTicketDraft;
    window.cancelTicketDraft = cancelTicketDraft;

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClientChat);
      } else {
        initClientChat();
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WES_KB, findTicketPublicStatus };
  }

})();
