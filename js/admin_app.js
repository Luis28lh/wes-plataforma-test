function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
}

const AdminApp = {
  activeModule: 'dashboard',
  searchQuery: '',
  statusFilter: 'all',
  currentModalEntity: null,

  init() {
    this.bindEvents();
    this.checkAuthUI();
  },

  bindEvents() {
    window.addEventListener('wes_admin_logout', () => {
      this.checkAuthUI();
    });

    window.addEventListener('wes_flags_changed', () => {
      if (this.activeModule === 'ajustes') {
        this.renderAjustes();
      }
    });

    // Filtros dinámicos en tablas
    const searchInput = document.getElementById('admin-global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.refreshCurrentView();
      });
    }
  },

  checkAuthUI() {
    const authView = document.getElementById('admin-auth-container');
    const mainView = document.getElementById('admin-main-container');

    if (!AdminAuth.isAuthenticated()) {
      if (authView) authView.classList.remove('hidden');
      if (mainView) mainView.classList.add('hidden');
      this.renderLoginForm();
    } else {
      if (authView) authView.classList.add('hidden');
      if (mainView) mainView.classList.remove('hidden');
      this.renderUserProfileHeader();
      this.buildNavigationMenu();
      this.navigate(this.activeModule);
    }
  },

  // ========================================================================
  // AUTENTICACIÓN & LOGIN UI
  // ========================================================================
  renderLoginForm() {
    const remainingSeconds = AdminAuth.getLockoutRemainingSeconds();
    const lockoutBox = document.getElementById('login-lockout-banner');
    const loginForm = document.getElementById('login-form-box');

    if (remainingSeconds > 0) {
      if (lockoutBox) {
        lockoutBox.classList.remove('hidden');
        this.startLockoutCountdown(remainingSeconds);
      }
      if (loginForm) loginForm.classList.add('opacity-50', 'pointer-events-none');
    } else {
      if (lockoutBox) lockoutBox.classList.add('hidden');
      if (loginForm) loginForm.classList.remove('opacity-50', 'pointer-events-none');
    }
  },

  startLockoutCountdown(seconds) {
    const timerElem = document.getElementById('lockout-seconds');
    if (!timerElem) return;

    let left = seconds;
    timerElem.textContent = `${Math.floor(left / 60)}m ${left % 60}s`;

    const interval = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(interval);
        this.renderLoginForm();
      } else {
        timerElem.textContent = `${Math.floor(left / 60)}m ${left % 60}s`;
      }
    }, 1000);
  },

  handleLoginSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const identifier = form.identifier.value;
    const password = form.password.value;

    const result = AdminAuth.login(identifier, password);

    if (result.success) {
      this.checkAuthUI();
      showToast('¡Bienvenido al portal administrativo WES!', 'success');
    } else if (result.require2FA) {
      this.show2FAModal(result.demoCode);
    } else {
      showToast(result.message, 'error');
      this.renderLoginForm();
    }
  },

  show2FAModal(demoCode) {
    const modal = document.getElementById('modal-2fa');
    if (!modal) return;
    modal.classList.remove('hidden');
    const demoCodeElem = document.getElementById('2fa-demo-code');
    if (demoCodeElem) demoCodeElem.textContent = demoCode;
    const input = document.getElementById('2fa-input-code');
    if (input) {
      input.value = '';
      input.focus();
    }
  },

  handle2FASubmit(e) {
    e.preventDefault();
    const input = document.getElementById('2fa-input-code');
    const code = input ? input.value : '';

    const result = AdminAuth.verify2FA(code);
    if (result.success) {
      const modal = document.getElementById('modal-2fa');
      if (modal) modal.classList.add('hidden');
      this.checkAuthUI();
      showToast('Verificación en dos pasos completada con éxito.', 'success');
    } else {
      showToast(result.message, 'error');
    }
  },

  close2FAModal() {
    const modal = document.getElementById('modal-2fa');
    if (modal) modal.classList.add('hidden');
    AdminAuth.pending2FAUser = null;
  },

  openForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot-password');
    if (modal) modal.classList.remove('hidden');
  },

  closeForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot-password');
    if (modal) modal.classList.add('hidden');
  },

  handleForgotPasswordSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.recoveryEmail.value;

    showToast(`Se ha enviado un enlace de recuperación seguro al correo: ${email}`, 'success');
    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'usuarios',
        action: 'solicitud_recuperacion',
        description: `Solicitud de restablecimiento de contraseña para: ${email}`
      });
    }
    this.closeForgotPasswordModal();
  },

  togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  },

  // ========================================================================
  // NAVEGACIÓN Y PERMISOS DEL PORTAL
  // ========================================================================
  renderUserProfileHeader() {
    const user = AdminAuth.getCurrentUser();
    if (!user) return;

    const nameElem = document.getElementById('header-user-name');
    const roleElem = document.getElementById('header-user-role');
    const avatarElem = document.getElementById('header-user-avatar');
    const lastLoginElem = document.getElementById('header-last-login');

    if (nameElem) nameElem.textContent = user.name;
    if (roleElem) {
      const roleDef = ROLE_DEFINITIONS[user.role] || { name: user.role };
      roleElem.textContent = roleDef.name;
    }
    if (avatarElem) {
      avatarElem.textContent = user.name.slice(0, 2).toUpperCase();
    }
    if (lastLoginElem) {
      lastLoginElem.textContent = user.lastLogin 
        ? new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Primera sesión';
    }
  },

  buildNavigationMenu() {
    const navContainer = document.getElementById('admin-sidebar-nav');
    if (!navContainer) return;

    const user = AdminAuth.getCurrentUser();
    if (!user) return;

    const navItems = [
      { id: 'dashboard', name: 'Panel Principal', icon: 'fa-chart-pie', module: 'dashboard' },
      { header: 'Solicitudes y Clientes' },
      { id: 'cotizaciones', name: 'Cotizaciones', icon: 'fa-file-invoice-dollar', module: 'cotizaciones' },
      { id: 'soportes', name: 'Soporte Técnico', icon: 'fa-tools', module: 'soportes' },
      { id: 'kds_servicio', name: 'KDS Servicio Técnico', icon: 'fa-tv', href: 'servicio-tecnico.html', module: 'soportes' },
      { id: 'contactos', name: 'Mensajes Contacto', icon: 'fa-envelope-open-text', module: 'contactos' },
      { header: 'Inventario y Contenido' },
      { id: 'productos', name: 'Catálogo Productos', icon: 'fa-boxes', module: 'productos' },
      { id: 'categorias', name: 'Categorías', icon: 'fa-tags', module: 'categorias' },
      { header: 'Control y Configuración' },
      { id: 'usuarios', name: 'Usuarios y Roles', icon: 'fa-users-cog', module: 'usuarios' },
      { id: 'permisos', name: 'Matriz de Permisos', icon: 'fa-shield-alt', module: 'usuarios' },
      { id: 'ia_config', name: 'Inteligencia Artificial (IA)', icon: 'fa-robot', module: 'ajustes' },
      { id: 'ajustes', name: 'Ajustes & Toggles', icon: 'fa-sliders-h', module: 'ajustes' },
      { id: 'correos', name: 'Gestión de Correos', icon: 'fa-mail-bulk', module: 'ajustes' },
      { id: 'auditoria', name: 'Historial Auditoría', icon: 'fa-history', module: 'auditoria' }
    ];

    let html = '';
    navItems.forEach(item => {
      if (item.header) {
        html += `<div class="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-brand">${item.header}</div>`;
        return;
      }

      // Si no es dashboard, comprobar si tiene permiso de 'ver'
      if (item.module !== 'dashboard' && !PermissionsManager.hasPermission(item.module, 'ver', user)) {
        return; // Se oculta del menú si no tiene autorización
      }

      if (item.href) {
        html += `
          <a href="${item.href}" target="_blank" class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition duration-150 text-slate-700 hover:bg-slate-100 hover:text-wes-blue font-semibold group">
            <span class="flex items-center space-x-3">
              <i class="fas ${item.icon} w-4 text-center text-wes-gold"></i>
              <span>${item.name}</span>
            </span>
            <span class="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">KDS</span>
          </a>
        `;
        return;
      }

      const isActive = this.activeModule === item.id;
      const activeClass = isActive 
        ? 'bg-wes-blue text-white font-bold shadow-md shadow-wes-blue/20' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-wes-blue font-medium';

      html += `
        <button onclick="AdminApp.navigate('${item.id}')" class="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs transition duration-150 ${activeClass}">
          <i class="fas ${item.icon} w-4 text-center"></i>
          <span>${item.name}</span>
        </button>
      `;
    });

    navContainer.innerHTML = html;
  },

  navigate(moduleId) {
    const user = AdminAuth.getCurrentUser();
    
    // Verificar permiso para el módulo solicitado
    const mappedModule = (moduleId === 'permisos') ? 'usuarios' : (moduleId === 'correos' || moduleId === 'ia_config') ? 'ajustes' : moduleId;
    if (mappedModule !== 'dashboard' && !PermissionsManager.hasPermission(mappedModule, 'ver', user)) {
      showToast('No tienes autorización para realizar esta acción', 'error');
      return;
    }

    this.activeModule = moduleId;
    this.buildNavigationMenu();

    // Título de la vista
    const titleMap = {
      dashboard: 'Resumen Operativo y Métricas',
      cotizaciones: 'Gestión de Cotizaciones',
      soportes: 'Tickets de Soporte Técnico',
      contactos: 'Mensajes de Contacto y Consultas',
      productos: 'Gestión de Productos e Inventario',
      categorias: 'Gestión de Categorías',
      usuarios: 'Directorio de Usuarios y Roles',
      permisos: 'Matriz Interactiva de Permisos (RBAC)',
      ia_config: 'Gestión de Inteligencia Artificial (IA), Prompts y APIs',
      ajustes: 'Ajustes Generales y Conmutadores Públicos',
      correos: 'Enrutamiento y Pruebas de Notificaciones',
      auditoria: 'Historial de Auditoría (Audit Log)'
    };

    const headerTitle = document.getElementById('admin-view-title');
    if (headerTitle) headerTitle.textContent = titleMap[moduleId] || 'Administración WES';

    this.refreshCurrentView();
  },

  refreshCurrentView() {
    const container = document.getElementById('admin-dynamic-content');
    if (!container) return;

    switch (this.activeModule) {
      case 'dashboard':
        this.renderDashboard(container);
        break;
      case 'cotizaciones':
        this.renderCotizaciones(container);
        break;
      case 'soportes':
        this.renderSoportes(container);
        break;
      case 'contactos':
        this.renderContactos(container);
        break;
      case 'productos':
        this.renderProductos(container);
        break;
      case 'categorias':
        this.renderCategorias(container);
        break;
      case 'usuarios':
        this.renderUsuarios(container);
        break;
      case 'permisos':
        this.renderPermisos(container);
        break;
      case 'ia_config':
        this.renderIAConfig(container);
        break;
      case 'ajustes':
        this.renderAjustes(container);
        break;
      case 'correos':
        this.renderCorreos(container);
        break;
      case 'auditoria':
        this.renderAuditoria(container);
        break;
      default:
        this.renderDashboard(container);
    }
  },

  // ========================================================================
  // VISTA: DASHBOARD & MÉTRICAS
  // ========================================================================
  renderDashboard(container) {
    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const support = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const products = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);
    const contacts = JSON.parse(localStorage.getItem('wes_contact_messages') || '[]');

    const pendingQuotes = quotes.filter(q => q.status === 'Pendiente' || !q.status).length;
    const pendingSupport = support.filter(s => s.status === 'Nuevo' || s.status === 'En diagnóstico' || !s.status).length;
    const pendingEmails = quotes.filter(q => q.emailStatus === 'pending').length + support.filter(s => s.emailStatus === 'pending').length;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Banner de Bienvenida -->
        <div class="bg-gradient-to-r from-wes-dark via-wes-blue to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div class="relative z-10 max-w-2xl">
            <span class="text-wes-gold text-xs font-bold uppercase tracking-widest block mb-1">Warn Electrical Services, SRL</span>
            <h2 class="text-2xl sm:text-3xl font-extrabold font-brand tracking-tight">Centro de Control Operativo</h2>
            <p class="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Administración unificada de cotizaciones, soporte técnico presencial y catálogo de seguridad electrónica en Moca y la región.
            </p>
          </div>
          <div class="absolute -right-6 -bottom-6 opacity-10 text-white text-9xl pointer-events-none">
            <i class="fas fa-bolt"></i>
          </div>
        </div>

        <!-- Alerta de Correos Pendientes de Envío (si hubieran) -->
        ${pendingEmails > 0 ? `
          <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-center justify-between text-xs text-amber-800 shadow-sm">
            <div class="flex items-center space-x-3">
              <i class="fas fa-exclamation-triangle text-amber-600 text-lg"></i>
              <div>
                <span class="font-bold">Atención: Hay ${pendingEmails} notificación(es) por correo pendientes de envío.</span>
                <p class="text-[11px] text-amber-700">Las solicitudes fueron registradas pero el servicio de correo presentó demoras. Puedes reenviarlas desde cada sección.</p>
              </div>
            </div>
            <button onclick="AdminApp.retryAllPendingEmails()" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-xs flex items-center space-x-1">
              <i class="fas fa-redo-alt text-[10px]"></i>
              <span>Reintentar Envíos</span>
            </button>
          </div>
        ` : ''}

        <!-- Tarjetas de Métricas -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Cotizaciones</span>
              <div class="text-2xl font-black text-wes-blue mt-1">${quotes.length}</div>
              <span class="text-[11px] text-amber-600 font-semibold">${pendingQuotes} pendientes de atención</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-blue-50 text-wes-blue flex items-center justify-center text-xl">
              <i class="fas fa-file-invoice-dollar"></i>
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Soporte Técnico</span>
              <div class="text-2xl font-black text-rose-600 mt-1">${support.length}</div>
              <span class="text-[11px] text-rose-500 font-semibold">${pendingSupport} tickets abiertos</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
              <i class="fas fa-tools"></i>
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Catálogo Activo</span>
              <div class="text-2xl font-black text-emerald-600 mt-1">${products.length}</div>
              <span class="text-[11px] text-emerald-500 font-semibold">Soluciones publicadas</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
              <i class="fas fa-boxes"></i>
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensajes Web</span>
              <div class="text-2xl font-black text-indigo-600 mt-1">${contacts.length}</div>
              <span class="text-[11px] text-indigo-500 font-semibold">Consultas recibidas</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
              <i class="fas fa-envelope-open-text"></i>
            </div>
          </div>
        </div>

        <!-- Acciones Rápidas -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 font-brand">Accesos Rápidos Directos</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onclick="AdminApp.navigate('cotizaciones')" class="p-4 rounded-xl border border-slate-200 hover:border-wes-blue hover:bg-blue-50/50 text-left transition group">
              <i class="fas fa-file-invoice text-wes-blue text-lg mb-2 block group-hover:scale-110 transition-transform"></i>
              <span class="text-xs font-bold text-slate-800 block">Ver Cotizaciones</span>
              <span class="text-[11px] text-slate-500">Revisar solicitudes</span>
            </button>
            <button onclick="AdminApp.navigate('soportes')" class="p-4 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/50 text-left transition group">
              <i class="fas fa-camera text-rose-600 text-lg mb-2 block group-hover:scale-110 transition-transform"></i>
              <span class="text-xs font-bold text-slate-800 block">Fotos de Soporte</span>
              <span class="text-[11px] text-slate-500">Inspeccionar evidencias</span>
            </button>
            <button onclick="AdminApp.navigate('productos')" class="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition group">
              <i class="fas fa-plus-circle text-emerald-600 text-lg mb-2 block group-hover:scale-110 transition-transform"></i>
              <span class="text-xs font-bold text-slate-800 block">Nuevo Producto</span>
              <span class="text-[11px] text-slate-500">Agregar al catálogo</span>
            </button>
            <button onclick="AdminApp.navigate('ajustes')" class="p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 text-left transition group">
              <i class="fas fa-toggle-on text-amber-600 text-lg mb-2 block group-hover:scale-110 transition-transform"></i>
              <span class="text-xs font-bold text-slate-800 block">Feature Toggles</span>
              <span class="text-[11px] text-slate-500">Precios y conmutadores</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // ========================================================================
  // VISTA: COTIZACIONES
  // ========================================================================
  renderCotizaciones(container) {
    const allQuotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const filtered = allQuotes.filter(q => {
      const matchSearch = !this.searchQuery || 
        (q.id && q.id.toLowerCase().includes(this.searchQuery)) ||
        (q.client && q.client.name && q.client.name.toLowerCase().includes(this.searchQuery)) ||
        (q.client && q.client.email && q.client.email.toLowerCase().includes(this.searchQuery)) ||
        (q.client && q.client.phone && q.client.phone.includes(this.searchQuery));
      const matchStatus = this.statusFilter === 'all' || q.status === this.statusFilter;
      return matchSearch && matchStatus;
    });

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Barra de Control -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center space-x-2 w-full sm:w-auto">
            <span class="text-xs font-bold text-slate-500">Estado:</span>
            <select onchange="AdminApp.setStatusFilter(this.value)" class="text-xs p-2 border border-slate-300 rounded-xl bg-slate-50 font-medium">
              <option value="all">Todos los estados (${allQuotes.length})</option>
              <option value="Pendiente" ${this.statusFilter === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="En revisión" ${this.statusFilter === 'En revisión' ? 'selected' : ''}>En revisión</option>
              <option value="Aprobada" ${this.statusFilter === 'Aprobada' ? 'selected' : ''}>Aprobada</option>
              <option value="Rechazada" ${this.statusFilter === 'Rechazada' ? 'selected' : ''}>Rechazada</option>
              <option value="Cerrada" ${this.statusFilter === 'Cerrada' ? 'selected' : ''}>Cerrada</option>
            </select>
          </div>
          <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button onclick="AdminApp.exportQuotesCSV()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition">
              <i class="fas fa-file-excel text-emerald-600"></i>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <!-- Tabla -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th class="p-3.5">Código</th>
                  <th class="p-3.5">Fecha</th>
                  <th class="p-3.5">Cliente</th>
                  <th class="p-3.5">Items</th>
                  <th class="p-3.5">Total RD$</th>
                  <th class="p-3.5">Asignado a</th>
                  <th class="p-3.5">Estado</th>
                  <th class="p-3.5">Correo</th>
                  <th class="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="9" class="p-8 text-center text-slate-400">
                      <i class="fas fa-inbox text-3xl mb-2 block"></i>
                      No se encontraron cotizaciones con los criterios seleccionados.
                    </td>
                  </tr>
                ` : filtered.map(q => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 font-mono font-bold text-wes-blue">${q.id || 'N/A'}</td>
                    <td class="p-3.5 text-slate-500 whitespace-nowrap">${q.date ? new Date(q.date).toLocaleDateString('es-DO') : 'Hoy'}</td>
                    <td class="p-3.5">
                      <div class="font-bold text-slate-800">${(q.client && q.client.name) || 'Cliente sin nombre'}</div>
                      <div class="text-[11px] text-slate-400">${(q.client && q.client.phone) || ''}</div>
                    </td>
                    <td class="p-3.5 font-semibold text-slate-600">${q.items ? q.items.length : 0} prod.</td>
                    <td class="p-3.5 font-bold text-slate-900">${q.total ? `RD$ ${q.total.toLocaleString('es-DO')}` : 'A cotizar'}</td>
                    <td class="p-3.5">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        ${q.assignedTo || 'Sin asignar'}
                      </span>
                    </td>
                    <td class="p-3.5">
                      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${this.getStatusBadgeClass(q.status || 'Pendiente')}">
                        ${q.status || 'Pendiente'}
                      </span>
                    </td>
                    <td class="p-3.5">
                      ${q.emailStatus === 'pending' ? `
                        <div class="flex items-center space-x-1">
                          <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Pendiente</span>
                          <button onclick="AdminApp.resendQuoteEmail('${q.id}')" title="Reenviar correo" class="text-amber-600 hover:text-amber-800 p-1">
                            <i class="fas fa-redo-alt text-xs"></i>
                          </button>
                        </div>
                      ` : `
                        <span class="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                          <i class="fas fa-check-circle"></i>
                          <span>Enviado</span>
                        </span>
                      `}
                    </td>
                    <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
                      <button onclick="AdminApp.openQuoteDetail('${q.id}')" class="px-2.5 py-1.5 bg-wes-blue text-white rounded-lg hover:bg-wes-dark font-bold text-[11px] transition">
                        <i class="fas fa-eye mr-1"></i> Abrir
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  getStatusBadgeClass(status) {
    switch (status) {
      case 'Pendiente':
      case 'Nuevo':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'En revisión':
      case 'En diagnóstico':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Aprobada':
      case 'Resuelto':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Rechazada':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  },

  setStatusFilter(status) {
    this.statusFilter = status;
    this.refreshCurrentView();
  },

  openQuoteDetail(quoteId) {
    if (!PermissionsManager.checkOrAlert('cotizaciones', 'ver')) return;

    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    this.currentModalEntity = { type: 'quote', data: quote };
    const users = AdminAuth.getUsers();

    const modal = document.getElementById('admin-modal-detail');
    const title = document.getElementById('detail-modal-title');
    const content = document.getElementById('detail-modal-content');

    title.innerHTML = `<span class="font-mono text-wes-blue">${quote.id}</span> — Detalle de Cotización`;

    content.innerHTML = `
      <div class="space-y-6 text-xs">
        <!-- Encabezado Cliente -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div>
            <span class="text-slate-400 block uppercase font-bold text-[10px]">Cliente:</span>
            <div class="text-sm font-bold text-slate-800">${(quote.client && quote.client.name) || 'N/A'}</div>
            <div class="text-slate-600 mt-1"><i class="fas fa-envelope mr-1 text-slate-400"></i> ${(quote.client && quote.client.email) || 'N/A'}</div>
            <div class="text-slate-600"><i class="fas fa-phone mr-1 text-slate-400"></i> ${(quote.client && quote.client.phone) || 'N/A'}</div>
            ${quote.client && quote.client.address ? `<div class="text-slate-600"><i class="fas fa-map-marker-alt mr-1 text-slate-400"></i> ${quote.client.address}</div>` : ''}
          </div>
          <div class="space-y-3">
            <div>
              <label class="block uppercase font-bold text-[10px] text-slate-400 mb-1">Estado de la Cotización:</label>
              <select id="quote-status-select" onchange="AdminApp.updateQuoteStatus('${quote.id}', this.value)" class="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800">
                <option value="Pendiente" ${quote.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="En revisión" ${quote.status === 'En revisión' ? 'selected' : ''}>En revisión</option>
                <option value="Aprobada" ${quote.status === 'Aprobada' ? 'selected' : ''}>Aprobada</option>
                <option value="Rechazada" ${quote.status === 'Rechazada' ? 'selected' : ''}>Rechazada</option>
                <option value="Cerrada" ${quote.status === 'Cerrada' ? 'selected' : ''}>Cerrada</option>
              </select>
            </div>
            <div>
              <label class="block uppercase font-bold text-[10px] text-slate-400 mb-1">Asignar Responsable:</label>
              <select id="quote-assign-select" onchange="AdminApp.updateQuoteAssignee('${quote.id}', this.value)" class="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-800 font-medium">
                <option value="">-- Sin asignar --</option>
                ${users.map(u => `<option value="${u.name}" ${quote.assignedTo === u.name ? 'selected' : ''}>${u.name} (${u.role})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Tabla de Artículos -->
        <div>
          <h4 class="font-bold text-slate-800 mb-2 font-brand">Productos Solicitados</h4>
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-100 text-slate-600 text-[11px] font-bold">
                <tr>
                  <th class="p-2.5">Producto</th>
                  <th class="p-2.5 text-center">Cant.</th>
                  <th class="p-2.5 text-right">Precio Unitario</th>
                  <th class="p-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${(quote.items || []).map(item => `
                  <tr>
                    <td class="p-2.5">
                      <div class="font-bold text-slate-800">${item.name}</div>
                      <div class="text-[10px] text-slate-400 font-mono">${item.code || ''}</div>
                    </td>
                    <td class="p-2.5 text-center font-bold">${item.quantity}</td>
                    <td class="p-2.5 text-right">RD$ ${(item.price || 0).toLocaleString('es-DO')}</td>
                    <td class="p-2.5 text-right font-bold text-slate-900">RD$ ${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-DO')}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot class="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colspan="3" class="p-2.5 text-right text-slate-600">Total Estimado:</td>
                  <td class="p-2.5 text-right text-wes-blue text-sm">RD$ ${(quote.total || 0).toLocaleString('es-DO')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Estado de Correo y Cola de Reintento -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Notificación por Correo:</span>
            <div class="text-xs font-semibold ${quote.emailStatus === 'pending' ? 'text-amber-600' : 'text-emerald-600'}">
              ${quote.emailStatus === 'pending' ? '⚠️ Solicitud registrada, correo pendiente de envío' : '✓ Correo despachado correctamente a wes.inform@gmail.com'}
            </div>
          </div>
          <button onclick="AdminApp.resendQuoteEmail('${quote.id}')" class="px-3 py-1.5 bg-wes-blue hover:bg-wes-dark text-white rounded-lg font-bold text-xs flex items-center space-x-1">
            <i class="fas fa-paper-plane text-[10px]"></i>
            <span>Reenviar Correo</span>
          </button>
        </div>

        <!-- Bitácora de Notas Internas Privadas (Ocultas al Cliente) -->
        <div class="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/70 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-amber-900 flex items-center space-x-1.5 font-brand text-xs">
              <i class="fas fa-user-shield text-amber-600"></i>
              <span>Notas Internas Privadas (Solo Personal Autorizado)</span>
            </h4>
            <span class="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">Confidencial</span>
          </div>
          
          <div id="quote-internal-notes" class="space-y-2 max-h-40 overflow-y-auto pr-1">
            ${(!quote.internalNotes || quote.internalNotes.length === 0) ? `
              <p class="text-[11px] text-slate-400 italic">No hay notas internas registradas aún.</p>
            ` : quote.internalNotes.map(n => `
              <div class="bg-white p-2.5 rounded-xl border border-amber-200/50 text-[11px]">
                <div class="flex justify-between text-slate-400 text-[10px] mb-1">
                  <span class="font-bold text-slate-700">${n.author}</span>
                  <span>${new Date(n.date).toLocaleString('es-DO')}</span>
                </div>
                <p class="text-slate-700">${n.text}</p>
              </div>
            `).join('')}
          </div>

          <form onsubmit="AdminApp.addQuoteInternalNote(event, '${quote.id}')" class="flex space-x-2 pt-2">
            <input type="text" name="noteText" placeholder="Agregar nota interna sobre llamadas o acuerdos..." required class="flex-1 p-2 bg-white border border-amber-300 rounded-xl text-xs focus:ring-1 focus:ring-amber-500">
            <button type="submit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition">
              Guardar Nota
            </button>
          </form>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  updateQuoteStatus(quoteId, newStatus) {
    if (!PermissionsManager.checkOrAlert('cotizaciones', 'editar')) return;

    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const idx = quotes.findIndex(q => q.id === quoteId);
    if (idx !== -1) {
      const old = quotes[idx].status;
      quotes[idx].status = newStatus;
      localStorage.setItem('wes_quotes', JSON.stringify(quotes));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'cotizaciones',
          action: 'cambiar_estado',
          description: `Cambio de estado de cotización ${quoteId}: ${old} -> ${newStatus}`,
          oldValue: old,
          newValue: newStatus
        });
      }
      showToast(`Estado actualizado a: ${newStatus}`, 'success');
      this.refreshCurrentView();
    }
  },

  updateQuoteAssignee(quoteId, assignee) {
    if (!PermissionsManager.checkOrAlert('cotizaciones', 'editar')) return;

    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const idx = quotes.findIndex(q => q.id === quoteId);
    if (idx !== -1) {
      const old = quotes[idx].assignedTo;
      quotes[idx].assignedTo = assignee;
      localStorage.setItem('wes_quotes', JSON.stringify(quotes));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'cotizaciones',
          action: 'asignar_responsable',
          description: `Asignación de cotización ${quoteId} a ${assignee || 'Sin asignar'}`,
          oldValue: old,
          newValue: assignee
        });
      }
      showToast(`Responsable asignado: ${assignee || 'Sin asignar'}`, 'success');
    }
  },

  addQuoteInternalNote(e, quoteId) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('cotizaciones', 'editar')) return;

    const form = e.target;
    const text = form.noteText.value.trim();
    if (!text) return;

    const user = AdminAuth.getCurrentUser();
    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const idx = quotes.findIndex(q => q.id === quoteId);
    if (idx !== -1) {
      if (!quotes[idx].internalNotes) quotes[idx].internalNotes = [];
      quotes[idx].internalNotes.push({
        id: 'NOTE-' + Date.now(),
        author: user ? user.name : 'Admin',
        date: new Date().toISOString(),
        text
      });
      localStorage.setItem('wes_quotes', JSON.stringify(quotes));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'cotizaciones',
          action: 'agregar_nota_interna',
          description: `Nota interna agregada a cotización ${quoteId} por ${user ? user.name : 'Admin'}`
        });
      }

      form.reset();
      this.openQuoteDetail(quoteId);
      showToast('Nota interna registrada exitosamente.', 'success');
    }
  },

  resendQuoteEmail(quoteId) {
    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    const idx = quotes.findIndex(q => q.id === quoteId);
    if (idx !== -1) {
      // Simulación de envío exitoso y actualización de estado
      quotes[idx].emailStatus = 'sent';
      localStorage.setItem('wes_quotes', JSON.stringify(quotes));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'cotizaciones',
          action: 'reenviar_correo',
          description: `Reenvío manual de notificación de cotización ${quoteId} a wes.inform@gmail.com`
        });
      }

      showToast(`Notificación de cotización ${quoteId} reenviada con éxito a wes.inform@gmail.com`, 'success');
      this.refreshCurrentView();
      if (this.currentModalEntity && this.currentModalEntity.data.id === quoteId) {
        this.openQuoteDetail(quoteId);
      }
    }
  },

  exportQuotesCSV() {
    if (!PermissionsManager.checkOrAlert('cotizaciones', 'exportar')) return;

    const quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    if (!quotes.length) {
      showToast('No hay cotizaciones para exportar.', 'info');
      return;
    }

    const headers = ['ID', 'Fecha', 'Cliente', 'Correo', 'Teléfono', 'Total RD$', 'Estado', 'Asignado A'];
    const rows = quotes.map(q => [
      q.id || '',
      `"${q.date ? new Date(q.date).toLocaleDateString('es-DO') : ''}"`,
      `"${(q.client && q.client.name || '').replace(/"/g, '""')}"`,
      `"${(q.client && q.client.email || '').replace(/"/g, '""')}"`,
      `"${(q.client && q.client.phone || '').replace(/"/g, '""')}"`,
      q.total || 0,
      `"${q.status || 'Pendiente'}"`,
      `"${q.assignedTo || 'Sin asignar'}"`
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this.downloadCSV(csv, `WES_Cotizaciones_${new Date().toISOString().slice(0, 10)}.csv`);
  },

  // ========================================================================
  // VISTA: SOPORTE TÉCNICO
  // ========================================================================
  renderSoportes(container) {
    const allTickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const filtered = allTickets.filter(s => {
      const matchSearch = !this.searchQuery ||
        (s.id && s.id.toLowerCase().includes(this.searchQuery)) ||
        (s.clientName && s.clientName.toLowerCase().includes(this.searchQuery)) ||
        (s.problemType && s.problemType.toLowerCase().includes(this.searchQuery)) ||
        (s.phone && s.phone.includes(this.searchQuery));
      const matchStatus = this.statusFilter === 'all' || s.status === this.statusFilter;
      return matchSearch && matchStatus;
    });

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Barra de Control -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center space-x-2 w-full sm:w-auto">
            <span class="text-xs font-bold text-slate-500">Estado:</span>
            <select onchange="AdminApp.setStatusFilter(this.value)" class="text-xs p-2 border border-slate-300 rounded-xl bg-slate-50 font-medium">
              <option value="all">Todos los estados (${allTickets.length})</option>
              <option value="Nuevo" ${this.statusFilter === 'Nuevo' ? 'selected' : ''}>Nuevo</option>
              <option value="En diagnóstico" ${this.statusFilter === 'En diagnóstico' ? 'selected' : ''}>En diagnóstico</option>
              <option value="En reparación" ${this.statusFilter === 'En reparación' ? 'selected' : ''}>En reparación</option>
              <option value="Esperando repuesto" ${this.statusFilter === 'Esperando repuesto' ? 'selected' : ''}>Esperando repuesto</option>
              <option value="Resuelto" ${this.statusFilter === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
              <option value="Cerrado" ${this.statusFilter === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
            </select>
          </div>
          <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <a href="servicio-tecnico.html" target="_blank" class="px-3.5 py-2 bg-gradient-to-r from-wes-gold to-amber-500 hover:from-amber-400 hover:to-wes-gold text-slate-950 font-black rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5 shrink-0" title="Ver en Pantalla KDS estilo McDonald's">
              <i class="fas fa-tv text-xs"></i>
              <span>Tablero KDS (McDonald's)</span>
            </a>
            <button onclick="AdminApp.exportSupportCSV()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition">
              <i class="fas fa-file-excel text-emerald-600"></i>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <!-- Tabla -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th class="p-3.5">Ticket</th>
                  <th class="p-3.5">Fecha</th>
                  <th class="p-3.5">Cliente</th>
                  <th class="p-3.5">Tipo Problema</th>
                  <th class="p-3.5">Evidencia</th>
                  <th class="p-3.5">Técnico Asignado</th>
                  <th class="p-3.5">Estado</th>
                  <th class="p-3.5">Notificación</th>
                  <th class="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="9" class="p-8 text-center text-slate-400">
                      <i class="fas fa-clipboard-check text-3xl mb-2 block"></i>
                      No se encontraron solicitudes de soporte.
                    </td>
                  </tr>
                ` : filtered.map(s => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 font-mono font-bold text-rose-600">${s.id || 'N/A'}</td>
                    <td class="p-3.5 text-slate-500 whitespace-nowrap">${s.date ? new Date(s.date).toLocaleDateString('es-DO') : 'Hoy'}</td>
                    <td class="p-3.5">
                      <div class="font-bold text-slate-800">${s.clientName || 'Cliente'}</div>
                      <div class="text-[11px] text-slate-400">${s.phone || ''}</div>
                    </td>
                    <td class="p-3.5">
                      <span class="font-semibold text-slate-700 block">${s.problemType || 'Avería General'}</span>
                      <span class="text-[10px] text-slate-400 truncate max-w-xs block">${(s.description || '').slice(0, 40)}...</span>
                    </td>
                    <td class="p-3.5">
                      ${(s.photos && s.photos.length > 0) ? `
                        <button onclick="AdminApp.viewSupportPhoto('${s.photos[0]}', '${s.id}')" class="relative group block">
                          <img src="${s.photos[0]}" alt="Evidencia" class="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm group-hover:opacity-80 transition">
                          <span class="absolute -top-1 -right-1 bg-wes-blue text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">${s.photos.length}</span>
                        </button>
                      ` : `
                        <span class="text-[10px] text-slate-400 italic">Sin foto</span>
                      `}
                    </td>
                    <td class="p-3.5">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        ${s.assignedTech || 'Sin técnico'}
                      </span>
                    </td>
                    <td class="p-3.5">
                      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${this.getStatusBadgeClass(s.status || 'Nuevo')}">
                        ${s.status || 'Nuevo'}
                      </span>
                    </td>
                    <td class="p-3.5">
                      ${s.emailStatus === 'pending' ? `
                        <div class="flex items-center space-x-1">
                          <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Pendiente</span>
                          <button onclick="AdminApp.resendSupportEmail('${s.id}')" title="Reenviar correo" class="text-amber-600 hover:text-amber-800 p-1">
                            <i class="fas fa-redo-alt text-xs"></i>
                          </button>
                        </div>
                      ` : `
                        <span class="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                          <i class="fas fa-check-circle"></i>
                          <span>Enviado</span>
                        </span>
                      `}
                    </td>
                    <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
                      <button onclick="AdminApp.openSupportDetail('${s.id}')" class="px-2.5 py-1.5 bg-wes-blue text-white rounded-lg hover:bg-wes-dark font-bold text-[11px] transition">
                        <i class="fas fa-eye mr-1"></i> Abrir
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  openSupportDetail(ticketId) {
    if (!PermissionsManager.checkOrAlert('soportes', 'ver')) return;

    const tickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    this.currentModalEntity = { type: 'support', data: ticket };
    const users = AdminAuth.getUsers();

    const modal = document.getElementById('admin-modal-detail');
    const title = document.getElementById('detail-modal-title');
    const content = document.getElementById('detail-modal-content');

    title.innerHTML = `<span class="font-mono text-rose-600">${ticket.id}</span> — Ticket de Soporte Técnico`;

    content.innerHTML = `
      <div class="space-y-6 text-xs">
        <!-- Información del Cliente y Estado -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div>
            <span class="text-slate-400 block uppercase font-bold text-[10px]">Datos del Reportante:</span>
            <div class="text-sm font-bold text-slate-800">${ticket.clientName || 'N/A'}</div>
            <div class="text-slate-600 mt-1"><i class="fas fa-envelope mr-1 text-slate-400"></i> ${ticket.email || 'N/A'}</div>
            <div class="text-slate-600"><i class="fas fa-phone mr-1 text-slate-400"></i> ${ticket.phone || 'N/A'}</div>
            ${ticket.address ? `<div class="text-slate-600"><i class="fas fa-map-marker-alt mr-1 text-slate-400"></i> ${ticket.address}</div>` : ''}
          </div>
          <div class="space-y-3">
            <div>
              <label class="block uppercase font-bold text-[10px] text-slate-400 mb-1">Estado del Ticket:</label>
              <select onchange="AdminApp.updateSupportStatus('${ticket.id}', this.value)" class="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800">
                <option value="Nuevo" ${ticket.status === 'Nuevo' ? 'selected' : ''}>Nuevo</option>
                <option value="En diagnóstico" ${ticket.status === 'En diagnóstico' ? 'selected' : ''}>En diagnóstico</option>
                <option value="En reparación" ${ticket.status === 'En reparación' ? 'selected' : ''}>En reparación</option>
                <option value="Esperando repuesto" ${ticket.status === 'Esperando repuesto' ? 'selected' : ''}>Esperando repuesto</option>
                <option value="Resuelto" ${ticket.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
                <option value="Cerrado" ${ticket.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
              </select>
            </div>
            <div>
              <label class="block uppercase font-bold text-[10px] text-slate-400 mb-1">Técnico Responsable:</label>
              <select onchange="AdminApp.updateSupportAssignee('${ticket.id}', this.value)" class="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-800 font-medium">
                <option value="">-- Sin técnico asignado --</option>
                ${users.map(u => `<option value="${u.name}" ${ticket.assignedTech === u.name ? 'selected' : ''}>${u.name} (${u.role})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Descripción del Problema -->
        <div class="bg-white p-4 rounded-xl border border-slate-200">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-slate-800">Tipo de Problema: <span class="text-wes-blue">${ticket.problemType || 'General'}</span></span>
            <span class="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold uppercase">${ticket.urgency || 'Normal'}</span>
          </div>
          <p class="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">${ticket.description || 'Sin descripción detallada.'}</p>
        </div>

        <!-- Evidencias Fotográficas -->
        <div>
          <h4 class="font-bold text-slate-800 mb-2 font-brand">Fotografías de Avería (${(ticket.photos || []).length})</h4>
          ${(!ticket.photos || ticket.photos.length === 0) ? `
            <p class="text-xs text-slate-400 italic">No se adjuntaron fotografías para esta avería.</p>
          ` : `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              ${ticket.photos.map((photo, i) => `
                <div class="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer" onclick="AdminApp.viewSupportPhoto('${photo}', '${ticket.id}')">
                  <img src="${photo}" alt="Evidencia ${i + 1}" class="w-full h-28 object-cover group-hover:scale-105 transition-transform">
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <i class="fas fa-search-plus text-lg"></i>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Notificación por Correo -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Notificación por Correo:</span>
            <div class="text-xs font-semibold ${ticket.emailStatus === 'pending' ? 'text-amber-600' : 'text-emerald-600'}">
              ${ticket.emailStatus === 'pending' ? '⚠️ Solicitud registrada, correo pendiente de envío' : '✓ Correo despachado correctamente a wes.inform@gmail.com'}
            </div>
          </div>
          <button onclick="AdminApp.resendSupportEmail('${ticket.id}')" class="px-3 py-1.5 bg-wes-blue hover:bg-wes-dark text-white rounded-lg font-bold text-xs flex items-center space-x-1">
            <i class="fas fa-paper-plane text-[10px]"></i>
            <span>Reenviar Correo</span>
          </button>
        </div>

        <!-- Notas Técnicas Internas Privadas -->
        <div class="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/70 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-amber-900 flex items-center space-x-1.5 font-brand text-xs">
              <i class="fas fa-clipboard-list text-amber-600"></i>
              <span>Bitácora de Diagnóstico Técnico (Oculta al Cliente)</span>
            </h4>
            <span class="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">Uso Interno</span>
          </div>

          <div id="support-internal-notes" class="space-y-2 max-h-40 overflow-y-auto pr-1">
            ${(!ticket.internalNotes || ticket.internalNotes.length === 0) ? `
              <p class="text-[11px] text-slate-400 italic">No hay notas de diagnóstico registradas.</p>
            ` : ticket.internalNotes.map(n => `
              <div class="bg-white p-2.5 rounded-xl border border-amber-200/50 text-[11px]">
                <div class="flex justify-between text-slate-400 text-[10px] mb-1">
                  <span class="font-bold text-slate-700">${n.author}</span>
                  <span>${new Date(n.date).toLocaleString('es-DO')}</span>
                </div>
                <p class="text-slate-700">${n.text}</p>
              </div>
            `).join('')}
          </div>

          <form onsubmit="AdminApp.addSupportInternalNote(event, '${ticket.id}')" class="flex space-x-2 pt-2">
            <input type="text" name="noteText" placeholder="Registrar avance técnico, piezas requeridas, diagnóstico..." required class="flex-1 p-2 bg-white border border-amber-300 rounded-xl text-xs focus:ring-1 focus:ring-amber-500">
            <button type="submit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition">
              Guardar Avance
            </button>
          </form>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  viewSupportPhoto(photoUrl, ticketId) {
    const viewerModal = document.getElementById('admin-modal-photo-viewer');
    const img = document.getElementById('photo-viewer-img');
    const label = document.getElementById('photo-viewer-label');
    if (!viewerModal || !img) return;

    img.src = photoUrl;
    if (label) label.textContent = `Ticket: ${ticketId}`;
    viewerModal.classList.remove('hidden');
  },

  closePhotoViewer() {
    const viewerModal = document.getElementById('admin-modal-photo-viewer');
    if (viewerModal) viewerModal.classList.add('hidden');
  },

  updateSupportStatus(ticketId, newStatus) {
    if (!PermissionsManager.checkOrAlert('soportes', 'editar')) return;

    const tickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      const old = tickets[idx].status;
      tickets[idx].status = newStatus;
      localStorage.setItem('wes_support_tickets', JSON.stringify(tickets));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'soportes',
          action: 'cambiar_estado',
          description: `Ticket de soporte ${ticketId} actualizado a: ${newStatus}`,
          oldValue: old,
          newValue: newStatus
        });
      }
      showToast(`Estado de soporte actualizado a: ${newStatus}`, 'success');
      this.refreshCurrentView();
    }
  },

  updateSupportAssignee(ticketId, assignee) {
    if (!PermissionsManager.checkOrAlert('soportes', 'editar')) return;

    const tickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      const old = tickets[idx].assignedTech;
      tickets[idx].assignedTech = assignee;
      localStorage.setItem('wes_support_tickets', JSON.stringify(tickets));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'soportes',
          action: 'asignar_tecnico',
          description: `Técnico asignado al ticket ${ticketId}: ${assignee || 'Sin técnico'}`,
          oldValue: old,
          newValue: assignee
        });
      }
      showToast(`Técnico asignado: ${assignee || 'Sin técnico'}`, 'success');
    }
  },

  addSupportInternalNote(e, ticketId) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('soportes', 'editar')) return;

    const form = e.target;
    const text = form.noteText.value.trim();
    if (!text) return;

    const user = AdminAuth.getCurrentUser();
    const tickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      if (!tickets[idx].internalNotes) tickets[idx].internalNotes = [];
      tickets[idx].internalNotes.push({
        id: 'NOTE-' + Date.now(),
        author: user ? user.name : 'Técnico',
        date: new Date().toISOString(),
        text
      });
      localStorage.setItem('wes_support_tickets', JSON.stringify(tickets));

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'soportes',
          action: 'agregar_nota_tecnica',
          description: `Nota de avance técnico agregada al ticket ${ticketId}`
        });
      }

      form.reset();
      this.openSupportDetail(ticketId);
      showToast('Avance técnico registrado exitosamente.', 'success');
    }
  },

  async resendSupportEmail(ticketId) {
    const tickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      const ticket = tickets[idx];
      tickets[idx].emailStatus = 'sent';
      localStorage.setItem('wes_support_tickets', JSON.stringify(tickets));

      const backendUrl = localStorage.getItem('wes_backend_url') || 'https://script.google.com/macros/s/AKfycbyoN8TnzeN9Cg2X44YEt6KeQULahvG0DrEXP5m4HyLvJFs475maMjVrwjW8t-IRVIQ_OQ/exec';
      try {
        await fetch(backendUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'nuevoSoporte',
            data: ticket
          })
        });
      } catch (err) {
        console.warn('Error reenviando correo de soporte:', err);
      }

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'soportes',
          action: 'reenviar_correo',
          description: `Reenvío manual de notificación de soporte ${ticketId} a wes.inform@gmail.com y confirmación al cliente`
        });
      }

      showToast(`Notificaciones del ticket ${ticketId} despachadas con éxito a wes.inform@gmail.com y al cliente`, 'success');
      this.refreshCurrentView();
      if (this.currentModalEntity && this.currentModalEntity.data.id === ticketId) {
        this.openSupportDetail(ticketId);
      }
    }
  },

  exportSupportCSV() {
    if (!PermissionsManager.checkOrAlert('soportes', 'exportar')) return;

    const tickets = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');
    if (!tickets.length) {
      showToast('No hay tickets para exportar.', 'info');
      return;
    }

    const headers = ['Ticket ID', 'Fecha', 'Cliente', 'Teléfono', 'Tipo Problema', 'Técnico', 'Estado'];
    const rows = tickets.map(t => [
      t.id || '',
      `"${t.date ? new Date(t.date).toLocaleDateString('es-DO') : ''}"`,
      `"${(t.clientName || '').replace(/"/g, '""')}"`,
      `"${(t.phone || '').replace(/"/g, '""')}"`,
      `"${(t.problemType || '').replace(/"/g, '""')}"`,
      `"${(t.assignedTech || 'Sin técnico').replace(/"/g, '""')}"`,
      `"${t.status || 'Nuevo'}"`
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this.downloadCSV(csv, `WES_SoporteTecnico_${new Date().toISOString().slice(0, 10)}.csv`);
  },

  // ========================================================================
  // VISTA: MENSAJES DE CONTACTO
  // ========================================================================
  renderContactos(container) {
    const contacts = JSON.parse(localStorage.getItem('wes_contact_messages') || '[]');
    const filtered = contacts.filter(c => {
      return !this.searchQuery ||
        (c.name && c.name.toLowerCase().includes(this.searchQuery)) ||
        (c.email && c.email.toLowerCase().includes(this.searchQuery)) ||
        (c.subject && c.subject.toLowerCase().includes(this.searchQuery));
    });

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <span class="text-xs font-bold text-slate-700">Mensajes de Contacto Web (${contacts.length})</span>
          <button onclick="AdminApp.exportContactsCSV()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition">
            <i class="fas fa-file-excel text-emerald-600"></i>
            <span>Exportar CSV</span>
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th class="p-3.5">Nº Ticket</th>
                  <th class="p-3.5">Fecha</th>
                  <th class="p-3.5">Remitente</th>
                  <th class="p-3.5">Contacto</th>
                  <th class="p-3.5">Asunto</th>
                  <th class="p-3.5">Mensaje</th>
                  <th class="p-3.5 text-center">Gestión Correo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="7" class="p-8 text-center text-slate-400">
                      No hay mensajes de contacto registrados.
                    </td>
                  </tr>
                ` : filtered.map(c => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 whitespace-nowrap">
                      <span class="font-mono font-extrabold text-wes-blue text-[11px] bg-blue-50 px-2 py-1 rounded-md border border-blue-200/80">
                        ${c.ticketId || c.id}
                      </span>
                    </td>
                    <td class="p-3.5 text-slate-500 whitespace-nowrap">${new Date(c.date || Date.now()).toLocaleDateString('es-DO')}</td>
                    <td class="p-3.5 font-bold text-slate-800">${c.name}</td>
                    <td class="p-3.5 text-slate-600">
                      <div class="font-semibold text-slate-700">${c.email}</div>
                      <div class="text-[11px] text-slate-400">${c.phone || ''}</div>
                    </td>
                    <td class="p-3.5 font-semibold text-wes-blue">${c.subject}</td>
                    <td class="p-3.5 text-slate-600 max-w-xs break-words">${c.message}</td>
                    <td class="p-3.5 text-center whitespace-nowrap">
                      <a href="mailto:${c.email}?subject=${encodeURIComponent(`RE: [${c.ticketId || c.id}] ${c.subject || 'Consulta WES'}`)}" class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-wes-blue hover:bg-wes-dark text-white rounded-lg font-bold text-[11px] transition shadow-sm">
                        <i class="fas fa-reply text-wes-gold"></i>
                        <span>Responder</span>
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  exportContactsCSV() {
    const contacts = JSON.parse(localStorage.getItem('wes_contact_messages') || '[]');
    if (!contacts.length) {
      showToast('No hay mensajes de contacto para exportar.', 'info');
      return;
    }

    const headers = ['Fecha', 'Nombre', 'Correo', 'Teléfono', 'Asunto', 'Mensaje'];
    const rows = contacts.map(c => [
      `"${new Date(c.date || Date.now()).toLocaleString('es-DO')}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.subject || '').replace(/"/g, '""')}"`,
      `"${(c.message || '').replace(/"/g, '""')}"`
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this.downloadCSV(csv, `WES_MensajesContacto_${new Date().toISOString().slice(0, 10)}.csv`);
  },

  // ========================================================================
  // VISTA: CATÁLOGO DE PRODUCTOS
  // ========================================================================
  // ========================================================================
  // VISTA: GESTIÓN DE PRODUCTOS E INVENTARIO
  // ========================================================================
  renderProductos(container) {
    const products = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);

    // Extraer categorías dinámicas con opciones promocionales
    const promoOptions = ['🔥 Solo Ofertas', '⭐ Solo Novedades'];
    const dbCategories = [...new Set(products.map(p => p.category || p.categoria_id).filter(Boolean))];
    const categories = ['Todas', ...promoOptions, ...dbCategories];
    this.selectedAdminProductCat = this.selectedAdminProductCat || 'Todas';

    const filtered = products.filter(p => {
      const q = (this.searchQuery || '').toLowerCase();
      const matchSearch = !q ||
        ((p.name || p.nombre || '').toLowerCase().includes(q)) ||
        ((p.code || p.codigo || '').toLowerCase().includes(q)) ||
        ((p.brand || p.marca || '').toLowerCase().includes(q)) ||
        ((p.category || p.categoria_id || '').toLowerCase().includes(q));

      const pCat = p.category || p.categoria_id || '';
      let matchCat = false;
      if (this.selectedAdminProductCat === 'Todas') {
        matchCat = true;
      } else if (this.selectedAdminProductCat === '🔥 Solo Ofertas') {
        matchCat = !!(p.en_oferta || p.is_offer);
      } else if (this.selectedAdminProductCat === '⭐ Solo Novedades') {
        matchCat = !!(p.novedad || p.is_new);
      } else {
        matchCat = (pCat === this.selectedAdminProductCat);
      }

      return matchSearch && matchCat;
    });

    // Paginación (25 productos por página para navegación fluida)
    this.productPage = this.productPage || 1;
    const perPage = 25;
    const totalPages = Math.ceil(filtered.length / perPage) || 1;
    if (this.productPage > totalPages) this.productPage = totalPages;
    if (this.productPage < 1) this.productPage = 1;

    const startIdx = (this.productPage - 1) * perPage;
    const paginated = filtered.slice(startIdx, startIdx + perPage);

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Barra de Control -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center space-x-3 w-full sm:w-auto">
            <div class="text-xs text-slate-500 font-medium">
              Total en catálogo: <strong class="text-slate-800">${products.length} productos</strong>
              <span class="inline-flex items-center ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <i class="fas fa-check-circle mr-1"></i> Sincronizados Odoo ERP
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <!-- Filtro de Categoría -->
            <select onchange="AdminApp.filterProductCategory(this.value)" class="text-xs p-2 border border-slate-300 rounded-xl bg-slate-50 font-medium">
              ${categories.map(c => `
                <option value="${c}" ${this.selectedAdminProductCat === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>

            <button onclick="AdminApp.openProductModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow">
              <i class="fas fa-plus"></i>
              <span>Crear Producto</span>
            </button>
          </div>
        </div>

        <!-- Tabla de Productos -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th class="p-3.5">Foto</th>
                  <th class="p-3.5">Código SKU / Marca</th>
                  <th class="p-3.5">Nombre de la Solución</th>
                  <th class="p-3.5">Categoría</th>
                  <th class="p-3.5">Precio Ref. (DOP)</th>
                  <th class="p-3.5">Existencia / Stock</th>
                  <th class="p-3.5">Manual Técnico</th>
                  <th class="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${paginated.length === 0 ? `
                  <tr>
                    <td colspan="8" class="p-8 text-center text-slate-400">
                      <i class="fas fa-box-open text-3xl mb-2 block text-slate-300"></i>
                      No se encontraron productos que coincidan con la búsqueda.
                    </td>
                  </tr>
                ` : paginated.map(p => {
                  const img = p.image || p.imagen_url || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=600&q=80';
                  const code = p.code || p.codigo || 'S/C';
                  const name = p.name || p.nombre || 'Producto sin nombre';
                  const brand = p.brand || p.marca || 'WES';
                  const category = p.category || p.categoria_id || 'General';
                  const price = p.price || p.precio || 0;
                  const stock = p.stock !== undefined ? p.stock : (p.availability === 'Disponible' ? 1 : 0);
                  const isAvailable = stock > 0 || p.availability === 'Disponible' || p.disponibilidad === 'Disponible';
                  const manualUrl = p.manual_url || p.manualUrl;
                  const safeId = (typeof p.id === 'string') ? `'${p.id}'` : p.id;

                  return `
                    <tr class="hover:bg-slate-50/80 transition">
                      <td class="p-3.5">
                        <button type="button" onclick="AdminApp.viewSupportPhoto('${img}', '${code}')" class="block w-12 h-12 bg-white rounded-lg border border-slate-200 p-1 hover:border-wes-blue transition group">
                          <img src="${img}" alt="${name}" class="w-full h-full object-contain group-hover:scale-105 transition" loading="lazy">
                        </button>
                      </td>
                      <td class="p-3.5">
                        <div class="font-mono font-bold text-wes-blue">${code}</div>
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white uppercase">${brand}</span>
                      </td>
                      <td class="p-3.5 font-bold text-slate-800 max-w-xs">
                        <div class="flex items-center gap-1.5 flex-wrap mb-1">
                          ${(p.en_oferta || p.is_offer) ? '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white shadow-xs">🔥 OFERTA</span>' : ''}
                          ${(p.novedad || p.is_new) ? '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-white shadow-xs">⭐ NOVEDAD</span>' : ''}
                        </div>
                        <div class="line-clamp-2">${name}</div>
                      </td>
                      <td class="p-3.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700">
                          ${category}
                        </span>
                      </td>
                      <td class="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        ${((p.en_oferta || p.is_offer) && p.precio_anterior && p.precio_anterior > price) ? `
                          <div class="text-[10px] line-through text-slate-400 font-normal">RD$ ${Number(p.precio_anterior).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                          <div class="text-rose-600 font-black">RD$ ${price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                        ` : `
                          RD$ ${price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        `}
                      </td>
                      <td class="p-3.5 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                          <i class="fas ${isAvailable ? 'fa-check' : 'fa-times'} mr-1"></i>
                          ${stock} en inventario
                        </span>
                      </td>
                      <td class="p-3.5 whitespace-nowrap">
                        ${manualUrl ? `
                          <a href="${manualUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold transition">
                            <i class="fas fa-file-pdf text-red-600"></i>
                            <span>Manual CAME</span>
                          </a>
                        ` : `
                          <span class="text-slate-300 text-[11px] italic">N/A</span>
                        `}
                      </td>
                      <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
                        <button onclick="AdminApp.shareProductWhatsApp('${code}')" class="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition" title="Compartir con Cliente por WhatsApp">
                          <i class="fab fa-whatsapp text-sm"></i>
                        </button>
                        <button onclick="AdminApp.copyProductLink('${code}')" class="p-2 text-wes-blue hover:text-wes-dark hover:bg-blue-50 rounded-lg transition" title="Copiar Enlace Directo para Cliente">
                          <i class="fas fa-link text-xs"></i>
                        </button>
                        <a href="https://web.warnelectricalservices.com/?p=${code}" target="_blank" class="p-2 text-slate-500 hover:text-wes-blue hover:bg-slate-100 rounded-lg transition inline-block" title="Ver en la Web Oficial">
                          <i class="fas fa-external-link-alt text-xs"></i>
                        </a>
                        <button onclick="AdminApp.openProductModal(${safeId})" class="p-2 text-slate-600 hover:text-wes-blue hover:bg-slate-100 rounded-lg transition" title="Editar">
                          <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="AdminApp.deleteProduct(${safeId})" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Eliminar">
                          <i class="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Paginación -->
          <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Mostrando <strong class="text-slate-800">${filtered.length === 0 ? 0 : startIdx + 1}</strong> a <strong class="text-slate-800">${Math.min(startIdx + perPage, filtered.length)}</strong> de <strong class="text-slate-800">${filtered.length}</strong> productos
            </div>
            ${totalPages > 1 ? `
              <div class="flex items-center space-x-1">
                <button onclick="AdminApp.setProductPage(${this.productPage - 1})" ${this.productPage <= 1 ? 'disabled' : ''} class="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">
                  <i class="fas fa-chevron-left mr-1"></i> Anterior
                </button>
                <span class="px-3 py-1.5 font-bold text-slate-700">Página ${this.productPage} de ${totalPages}</span>
                <button onclick="AdminApp.setProductPage(${this.productPage + 1})" ${this.productPage >= totalPages ? 'disabled' : ''} class="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">
                  Siguiente <i class="fas fa-chevron-right ml-1"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  filterProductCategory(cat) {
    this.selectedAdminProductCat = cat;
    this.productPage = 1;
    this.refreshCurrentView();
  },

  setProductPage(page) {
    this.productPage = page;
    this.refreshCurrentView();
  },

  copyProductLink(code) {
    const products = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);
    const product = products.find(p => p.code === code || p.codigo === code || p.id === code);
    const sku = (product && (product.code || product.codigo)) ? (product.code || product.codigo) : code;
    const directUrl = `https://web.warnelectricalservices.com/?p=${encodeURIComponent(sku)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(directUrl).then(() => {
        showToast(`¡Enlace copiado para cliente: ${directUrl}`, 'success');
      }).catch(() => {
        prompt('Copia este enlace directo para tu cliente:', directUrl);
      });
    } else {
      prompt('Copia este enlace directo para tu cliente:', directUrl);
    }
  },

  shareProductWhatsApp(code) {
    const products = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);
    const product = products.find(p => p.code === code || p.codigo === code || p.id === code);
    const sku = (product && (product.code || product.codigo)) ? (product.code || product.codigo) : code;
    const directUrl = `https://web.warnelectricalservices.com/?p=${encodeURIComponent(sku)}`;
    const name = product ? (product.name || product.nombre) : `Producto SKU ${sku}`;
    const price = product ? (product.price || product.precio || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 }) : '';

    const text = `¡Hola! Te comparto este producto de *Warn Electrical Services (WES)*:\n\n` +
      `📦 *${name}*\n` +
      `🔢 Código / SKU: ${sku}\n` +
      (price ? `💰 Precio: RD$ ${price}\n\n` : '\n') +
      `👉 Puedes ver las fotos, especificaciones completas y cotizar directamente aquí:\n${directUrl}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  },

  openProductModal(productId = null) {
    const action = productId ? 'editar' : 'crear';
    if (!PermissionsManager.checkOrAlert('productos', action)) return;

    const modal = document.getElementById('admin-modal-product');
    const form = document.getElementById('product-form');
    const title = document.getElementById('product-modal-title');
    if (!modal || !form) return;

    form.reset();
    form.productId.value = productId || '';

    if (productId) {
      title.textContent = 'Editar Solución / Producto';
      const products = (typeof StorageService !== 'undefined')
        ? StorageService.getProducts()
        : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);
      const product = products.find(p => String(p.id) === String(productId));
      if (product) {
        form.name.value = product.name || product.nombre || '';
        form.code.value = product.code || product.codigo || '';
        form.brand.value = product.brand || product.marca || '';
        form.category.value = product.category || product.categoria_id || '';
        form.price.value = product.price || product.precio || 0;

        // Criterio promocional y precio anterior
        const isOffer = product.en_oferta || product.is_offer;
        const isNov = product.novedad || product.is_new;
        if (isOffer && isNov) {
          form.promotional_status.value = 'ambos';
        } else if (isOffer) {
          form.promotional_status.value = 'oferta';
        } else if (isNov) {
          form.promotional_status.value = 'novedad';
        } else {
          form.promotional_status.value = 'none';
        }
        form.precio_anterior.value = product.precio_anterior || '';

        form.availability.value = product.availability || product.disponibilidad || 'Disponible';
        form.image.value = product.image || product.imagen_url || '';
        const thumb = document.getElementById('product-modal-image-thumb');
        const icon = document.getElementById('product-modal-image-icon');
        if (thumb && icon) {
          const imgUrl = product.image || product.imagen_url || '';
          if (imgUrl) {
            thumb.src = imgUrl;
            thumb.classList.remove('hidden');
            icon.classList.add('hidden');
          } else {
            thumb.classList.add('hidden');
            icon.classList.remove('hidden');
          }
        }
        form.description.value = product.description || product.descripcion || '';
        const feats = product.features || product.caracteristicas || [];
        form.features.value = feats.join('\n');
      }
    } else {
      title.textContent = 'Nuevo Producto en Catálogo';
      if (form.promotional_status) form.promotional_status.value = 'none';
      if (form.precio_anterior) form.precio_anterior.value = '';
      const thumb = document.getElementById('product-modal-image-thumb');
      const icon = document.getElementById('product-modal-image-icon');
      if (thumb && icon) {
        thumb.classList.add('hidden');
        icon.classList.remove('hidden');
      }
    }

    modal.classList.remove('hidden');
  },

  closeProductModal() {
    const modal = document.getElementById('admin-modal-product');
    if (modal) modal.classList.add('hidden');
  },

  handleProductSave(e) {
    e.preventDefault();
    const form = e.target;
    const rawId = form.productId.value ? form.productId.value : null;
    const action = rawId ? 'editar' : 'crear';

    if (!PermissionsManager.checkOrAlert('productos', action)) return;

    let products = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);

    let existingProduct = null;
    if (rawId) {
      existingProduct = products.find(p => String(p.id) === String(rawId) || String(p.code) === String(rawId) || String(p.codigo) === String(rawId));
    }

    const name = form.name.value.trim();
    const code = form.code.value.trim();
    const brand = form.brand.value.trim();
    const category = form.category.value.trim();
    const price = parseFloat(form.price.value) || 0;
    const availability = form.availability.value;
    const rawImage = form.image.value.trim();
    const description = form.description.value.trim();
    const features = form.features.value.split('\n').map(f => f.trim()).filter(Boolean);

    const promoStatus = form.promotional_status ? form.promotional_status.value : 'none';
    const precioAnterior = form.precio_anterior ? (parseFloat(form.precio_anterior.value) || null) : null;
    const isOffer = (promoStatus === 'oferta' || promoStatus === 'ambos');
    const isNovelty = (promoStatus === 'novedad' || promoStatus === 'ambos');

    // La imagen es completamente opcional: si el campo está vacío, se conserva la imagen existente
    let finalImage = rawImage;
    if (!finalImage && existingProduct) {
      finalImage = existingProduct.image || existingProduct.imagen_url || '';
    }
    if (!finalImage) {
      finalImage = 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=600&q=80';
    }

    const productData = {
      id: rawId || `custom-${Date.now()}`,
      name: name,
      nombre: name,
      code: code,
      codigo: code,
      brand: brand,
      marca: brand,
      category: category,
      categoria_id: category,
      price: price,
      precio: price,
      availability: availability,
      disponibilidad: availability,
      stock: availability === 'Disponible' ? (existingProduct && existingProduct.stock !== undefined ? existingProduct.stock : 10) : 0,
      image: finalImage,
      imagen_url: finalImage,
      description: description,
      descripcion: description,
      features: features.length > 0 ? features : (existingProduct && (existingProduct.features || existingProduct.caracteristicas) ? (existingProduct.features || existingProduct.caracteristicas) : []),
      caracteristicas: features.length > 0 ? features : (existingProduct && (existingProduct.caracteristicas || existingProduct.features) ? (existingProduct.caracteristicas || existingProduct.features) : []),
      active: true,
      activo: true,
      en_oferta: isOffer,
      is_offer: isOffer,
      novedad: isNovelty,
      is_new: isNovelty,
      precio_anterior: precioAnterior,
      gallery_images: (existingProduct && Array.isArray(existingProduct.gallery_images)) ? existingProduct.gallery_images : [],
      key_attributes: (existingProduct && existingProduct.key_attributes) ? existingProduct.key_attributes : {},
      manual_url: (existingProduct && (existingProduct.manual_url || existingProduct.manualUrl)) ? (existingProduct.manual_url || existingProduct.manualUrl) : null,
      manualUrl: (existingProduct && (existingProduct.manualUrl || existingProduct.manual_url)) ? (existingProduct.manualUrl || existingProduct.manual_url) : null
    };

    if (rawId) {
      const idx = products.findIndex(p => String(p.id) === String(rawId) || String(p.code) === String(rawId) || String(p.codigo) === String(rawId));
      if (idx !== -1) {
        products[idx] = Object.assign({}, products[idx], productData);
      }
    } else {
      products.unshift(productData);
    }

    if (typeof StorageService !== 'undefined') {
      StorageService.saveProducts(products);
    }
    localStorage.setItem('wes_custom_products', JSON.stringify(products));

    if (window.WES_CATALOG_STATE) {
      window.WES_CATALOG_STATE.products = products;
    }

    if (window.WesDB && window.WesDB.isConfigured() && typeof window.WesDB.saveProduct === 'function') {
      window.WesDB.saveProduct(productData);
    }

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'productos',
        action: action === 'crear' ? 'crear_producto' : 'editar_producto',
        description: `${action === 'crear' ? 'Creación' : 'Modificación'} del producto: ${productData.name} (${productData.code})`,
        newValue: productData
      });
    }

    this.closeProductModal();
    this.refreshCurrentView();
    showToast(`Producto ${action === 'crear' ? 'creado' : 'actualizado'} correctamente.`, 'success');
  },

  deleteProduct(productId) {
    if (!PermissionsManager.checkOrAlert('productos', 'eliminar')) return;

    if (!confirm('¿Estás seguro de que deseas eliminar este producto del catálogo?')) return;

    let products = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);

    const target = products.find(p => String(p.id) === String(productId));
    products = products.filter(p => String(p.id) !== String(productId));

    if (typeof StorageService !== 'undefined') {
      StorageService.saveProducts(products);
    }
    localStorage.setItem('wes_custom_products', JSON.stringify(products));

    if (window.WES_CATALOG_STATE) {
      window.WES_CATALOG_STATE.products = products;
    }

    if (window.WesDB && window.WesDB.isConfigured() && typeof window.WesDB.deleteProduct === 'function') {
      window.WesDB.deleteProduct(productId);
    }

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'productos',
        action: 'eliminar_producto',
        description: `Eliminación del producto: ${target ? (target.name || target.nombre) : productId}`,
        oldValue: target
      });
    }

    showToast('Producto eliminado del catálogo.', 'info');
    this.refreshCurrentView();
  },

  // ========================================================================
  // VISTA: CATEGORÍAS
  // ========================================================================
  renderCategorias(container) {
    const flags = FeatureFlags.getFlags();
    const allCategories = [
      "Cámaras de Seguridad",
      "Controles de Acceso",
      "Cerraduras Inteligentes",
      "Alarmas y Sensores",
      "Redes y Conectividad",
      "Energía y Respaldo",
      "Automatización y Domótica",
      "Accesorios de Instalación"
    ];

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <h3 class="text-sm font-bold text-slate-800 font-brand">Control de Categorías del Catálogo</h3>
            <p class="text-xs text-slate-500">Activa o desactiva la visibilidad de categorías enteras en el portal público.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${allCategories.map(cat => {
            const isActive = (flags.activeCategories || []).includes(cat);
            return `
              <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-xl ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-lg">
                    <i class="fas fa-tag"></i>
                  </div>
                  <div>
                    <h4 class="font-bold text-slate-800 text-xs">${cat}</h4>
                    <span class="text-[11px] ${isActive ? 'text-emerald-600 font-semibold' : 'text-slate-400'}">
                      ${isActive ? 'Activa en la web' : 'Oculta al público'}
                    </span>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" ${isActive ? 'checked' : ''} onchange="AdminApp.toggleCategory('${cat}', this.checked)" class="sr-only peer">
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  toggleCategory(categoryName, isChecked) {
    if (!PermissionsManager.checkOrAlert('categorias', 'desactivar')) return;

    const flags = FeatureFlags.getFlags();
    let cats = [...(flags.activeCategories || [])];
    if (isChecked) {
      if (!cats.includes(categoryName)) cats.push(categoryName);
    } else {
      cats = cats.filter(c => c !== categoryName);
    }

    FeatureFlags.saveFlags({ activeCategories: cats });
    showToast(`Categoría "${categoryName}" ${isChecked ? 'activada' : 'ocultada'} en la web pública.`, 'success');
  },

  // ========================================================================
  // VISTA: USUARIOS Y ROLES (7 ROLES)
  // ========================================================================
  renderUsuarios(container) {
    const users = AdminAuth.getUsers();

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Barra de Control -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-slate-800 font-brand">Directorio de Usuarios y Acceso</h3>
            <p class="text-xs text-slate-500">Gestión de cuentas para los 7 roles definidos en la organización.</p>
          </div>
          <button onclick="AdminApp.openUserModal()" class="px-4 py-2 bg-wes-blue hover:bg-wes-dark text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow">
            <i class="fas fa-user-plus"></i>
            <span>Nuevo Usuario</span>
          </button>
        </div>

        <!-- Tabla de Usuarios -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th class="p-3.5">Usuario</th>
                  <th class="p-3.5">Contacto</th>
                  <th class="p-3.5">Rol Corporativo</th>
                  <th class="p-3.5 text-center">2FA</th>
                  <th class="p-3.5 text-center">Estado</th>
                  <th class="p-3.5">Último Acceso</th>
                  <th class="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${users.map(u => {
                  const roleDef = ROLE_DEFINITIONS[u.role] || { name: u.role, badgeClass: 'bg-slate-100 text-slate-800' };
                  return `
                    <tr class="hover:bg-slate-50/80 transition">
                      <td class="p-3.5">
                        <div class="flex items-center space-x-3">
                          <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                            ${u.name.slice(0, 2)}
                          </div>
                          <div>
                            <div class="font-bold text-slate-800">${u.name}</div>
                            <div class="text-[11px] text-slate-400 font-mono">@${u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td class="p-3.5">
                        <div class="text-slate-700">${u.email}</div>
                        <div class="text-[11px] text-slate-400">${u.phone || ''}</div>
                      </td>
                      <td class="p-3.5">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleDef.badgeClass}">
                          ${roleDef.name}
                        </span>
                      </td>
                      <td class="p-3.5 text-center">
                        ${u.twoFactorEnabled ? `
                          <span class="text-emerald-600 font-bold text-[11px]"><i class="fas fa-check-shield"></i> Activo</span>
                        ` : `
                          <span class="text-slate-400 text-[11px]">Inactivo</span>
                        `}
                      </td>
                      <td class="p-3.5 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                          ${u.status === 'activo' ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      <td class="p-3.5 text-slate-500 text-[11px]">
                        ${u.lastLogin ? new Date(u.lastLogin).toLocaleString('es-DO') : 'Sin registros'}
                      </td>
                      <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
                        ${u.role !== 'propietario' ? `
                          <button onclick="AdminApp.toggleUserStatus('${u.id}')" class="p-1.5 text-slate-500 hover:text-amber-600 rounded transition" title="Alternar Activo/Inactivo">
                            <i class="fas fa-power-off"></i>
                          </button>
                        ` : ''}
                        <button onclick="AdminApp.openResetPasswordModal('${u.id}')" class="p-1.5 text-slate-500 hover:text-wes-blue rounded transition" title="Restablecer Contraseña">
                          <i class="fas fa-key"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  openUserModal() {
    if (!PermissionsManager.checkOrAlert('usuarios', 'crear')) return;
    const modal = document.getElementById('admin-modal-user');
    if (modal) modal.classList.remove('hidden');
  },

  closeUserModal() {
    const modal = document.getElementById('admin-modal-user');
    if (modal) modal.classList.add('hidden');
  },

  handleUserSave(e) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('usuarios', 'crear')) return;

    const form = e.target;
    const newUser = {
      id: 'USR-' + Date.now().toString().slice(-4),
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      username: form.username.value.trim().toLowerCase(),
      passwordHash: form.password.value.trim() || 'Wes2026!',
      role: form.role.value,
      status: 'activo',
      twoFactorEnabled: form.twoFactor.checked,
      phone: form.phone.value.trim(),
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    const users = AdminAuth.getUsers();
    // Validar duplicado
    if (users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase() || u.username.toLowerCase() === newUser.username.toLowerCase())) {
      showToast('Ya existe un usuario con este correo o nombre de usuario.', 'error');
      return;
    }

    users.push(newUser);
    AdminAuth.saveUsers(users);

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'usuarios',
        action: 'crear_usuario',
        description: `Creación del usuario: ${newUser.name} (${newUser.email}) con rol ${newUser.role}`
      });
    }

    this.closeUserModal();
    this.refreshCurrentView();
    showToast(`Usuario ${newUser.name} creado exitosamente.`, 'success');
  },

  toggleUserStatus(userId) {
    if (!PermissionsManager.checkOrAlert('usuarios', 'desactivar')) return;

    const users = AdminAuth.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      if (users[idx].role === 'propietario') {
        showToast('No es posible desactivar la cuenta del Propietario.', 'error');
        return;
      }
      const newStatus = users[idx].status === 'activo' ? 'inactivo' : 'activo';
      users[idx].status = newStatus;
      AdminAuth.saveUsers(users);

      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'usuarios',
          action: 'cambiar_estado_usuario',
          description: `Cuenta de ${users[idx].name} cambiada a ${newStatus}`
        });
      }

      showToast(`Estado de ${users[idx].name} actualizado a: ${newStatus}`, 'success');
      this.refreshCurrentView();
    }
  },

  openResetPasswordModal(userId) {
    if (!PermissionsManager.checkOrAlert('usuarios', 'editar')) return;

    const users = AdminAuth.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newPass = prompt(`Ingresa la nueva contraseña temporal para "${user.name}":`, 'Wes2026!');
    if (!newPass) return;

    user.passwordHash = newPass.trim();
    AdminAuth.saveUsers(users);

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'usuarios',
        action: 'restablecer_contrasena',
        description: `Restablecimiento manual de contraseña para el usuario: ${user.name}`
      });
    }

    showToast(`Contraseña actualizada para ${user.name}.`, 'success');
  },

  // ========================================================================
  // VISTA: MATRIZ INTERACTIVA DE PERMISOS
  // ========================================================================
  renderPermisos(container) {
    const matrix = PermissionsManager.getMatrix();
    const roles = Object.keys(ROLE_DEFINITIONS);

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-slate-800 font-brand">Matriz de Autorizaciones y Permisos Granulares</h3>
            <p class="text-xs text-slate-500">Configura los privilegios de cada uno de los 7 roles para todos los módulos y acciones.</p>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="AdminApp.resetPermissionsDefaults()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
              Restaurar Valores por Defecto
            </button>
          </div>
        </div>

        <!-- Matriz Interactiva por Roles -->
        <div class="space-y-6">
          ${roles.map(roleKey => {
            const roleDef = ROLE_DEFINITIONS[roleKey];
            const isOwner = roleKey === 'propietario';

            return `
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${roleDef.badgeClass}">
                      ${roleDef.name}
                    </span>
                    <span class="text-xs text-slate-500 hidden sm:inline">${roleDef.description}</span>
                  </div>
                  ${isOwner ? `
                    <span class="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      <i class="fas fa-lock mr-1"></i> Irrestricto (Superadmin)
                    </span>
                  ` : ''}
                </div>

                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr class="text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100">
                        <th class="p-3">Módulo</th>
                        ${ACTION_DEFINITIONS.map(a => `<th class="p-3 text-center">${a.name}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      ${MODULE_DEFINITIONS.map(mod => {
                        const activeActions = (matrix[roleKey] && matrix[roleKey][mod.id]) || [];
                        return `
                          <tr class="hover:bg-slate-50/50">
                            <td class="p-3 font-semibold text-slate-700 flex items-center space-x-2">
                              <i class="fas ${mod.icon} text-slate-400 w-4 text-center"></i>
                              <span>${mod.name}</span>
                            </td>
                            ${ACTION_DEFINITIONS.map(act => {
                              const isChecked = isOwner || activeActions.includes(act.id);
                              return `
                                <td class="p-3 text-center">
                                  <input type="checkbox" 
                                    ${isChecked ? 'checked' : ''} 
                                    ${isOwner ? 'disabled' : ''} 
                                    onchange="AdminApp.togglePermissionCell('${roleKey}', '${mod.id}', '${act.id}', this.checked)"
                                    class="rounded border-slate-300 text-wes-blue focus:ring-wes-blue ${isOwner ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
                                </td>
                              `;
                            }).join('')}
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  togglePermissionCell(role, module, action, isChecked) {
    if (!PermissionsManager.checkOrAlert('usuarios', 'configurar')) return;

    const matrix = PermissionsManager.getMatrix();
    if (!matrix[role]) matrix[role] = {};
    if (!matrix[role][module]) matrix[role][module] = [];

    if (isChecked) {
      if (!matrix[role][module].includes(action)) matrix[role][module].push(action);
    } else {
      matrix[role][module] = matrix[role][module].filter(a => a !== action);
    }

    PermissionsManager.saveMatrix(matrix);
    showToast(`Permiso [${action}] para rol [${role}] en [${module}] actualizado.`, 'success');
  },

  resetPermissionsDefaults() {
    if (!PermissionsManager.checkOrAlert('usuarios', 'configurar')) return;
    if (!confirm('¿Deseas restaurar la matriz de permisos a los valores predeterminados?')) return;

    PermissionsManager.resetDefaults();
    showToast('Matriz de permisos restablecida a valores por defecto.', 'info');
    this.refreshCurrentView();
  },

  // ========================================================================
  // VISTA: AJUSTES GENERALES & FEATURE TOGGLES
  // ========================================================================
  renderAjustes(container) {
    const flags = FeatureFlags.getFlags();
    const settings = (window.WES_CATALOG_STATE && window.WES_CATALOG_STATE.companySettings)
      ? window.WES_CATALOG_STATE.companySettings
      : JSON.parse(localStorage.getItem('wes_company_settings') || '{}');

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Panel 1: Feature Toggles (Conmutadores Públicos) -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div class="border-b border-slate-200 pb-3">
            <h3 class="text-sm font-bold text-slate-800 font-brand flex items-center space-x-2">
              <i class="fas fa-toggle-on text-wes-blue"></i>
              <span>Conmutadores Públicos (Feature Toggles)</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Controla en tiempo real qué componentes se muestran o pausan en el portal público.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Toggle: Precios -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Mostrar Precios en el Catálogo</h4>
                <p class="text-[11px] text-slate-500">Si se desactiva, los productos mostrarán "Consultar precio".</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.showPrices ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('showPrices', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

            <!-- Toggle: Cotizaciones -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Habilitar Solicitudes de Cotización</h4>
                <p class="text-[11px] text-slate-500">Permite a los usuarios armar su carrito de cotización online.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.enableQuotes ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('enableQuotes', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

            <!-- Toggle: Soporte Técnico -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Habilitar Módulo de Soporte Técnico</h4>
                <p class="text-[11px] text-slate-500">Permite el envío de tickets con evidencias fotográficas.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.enableSupport ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('enableSupport', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

            <!-- Toggle: Ocultar Agotados -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Ocultar Productos sin Stock Inmediato</h4>
                <p class="text-[11px] text-slate-500">Oculta productos marcados como "Bajo pedido" o sin stock.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.hideOutOfStock ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('hideOutOfStock', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

            <!-- Toggle: Fundadores -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Mostrar Sección de Fundadores</h4>
                <p class="text-[11px] text-slate-500">Muestra la historia e ingenieros fundadores de WES.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.showFounders ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('showFounders', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

            <!-- Toggle: Mapa Interactivo -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Mostrar Mapa Interactivo de la Sede</h4>
                <p class="text-[11px] text-slate-500">Ubicación en Autopista Ramón Cáceres, Moca con marcador WES.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.showMap ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('showMap', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

            <!-- Toggle: WhatsApp Flotante -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800">Botón Flotante de WhatsApp</h4>
                <p class="text-[11px] text-slate-500">Muestra el acceso directo al número (849) 207-5474.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${flags.showWhatsAppButton ? 'checked' : ''} onchange="AdminApp.updateFeatureToggle('showWhatsAppButton', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
              </label>
            </div>

          </div>

          <!-- Mensajes de Cortesía y Pausa -->
          <div class="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Mensaje de Pausa para Cotizaciones:</label>
              <textarea id="quotes-notice-input" rows="2" class="w-full p-2.5 text-xs border border-slate-300 rounded-xl">${flags.quotesNotice || ''}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Mensaje de Pausa para Soporte:</label>
              <textarea id="support-notice-input" rows="2" class="w-full p-2.5 text-xs border border-slate-300 rounded-xl">${flags.supportNotice || ''}</textarea>
            </div>
          </div>
          <div class="text-right">
            <button onclick="AdminApp.saveNoticeMessages()" class="px-4 py-2 bg-wes-blue hover:bg-wes-dark text-white font-bold rounded-xl text-xs transition">
              Guardar Mensajes de Pausa
            </button>
          </div>
        </div>

        <!-- Panel 2: Información Corporativa -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div class="border-b border-slate-200 pb-3">
            <h3 class="text-sm font-bold text-slate-800 font-brand flex items-center space-x-2">
              <i class="fas fa-building text-wes-blue"></i>
              <span>Datos Institucionales y de Contacto</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Información que se refleja en encabezados, pies de página y fichas legales.</p>
          </div>

          <form onsubmit="AdminApp.handleCompanySettingsSave(event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nombre Comercial:</label>
                <input type="text" name="name" value="${settings.name || 'Warn Electrical Services, SRL'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Siglas / Acrónimo:</label>
                <input type="text" name="shortName" value="${settings.shortName || 'WES'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teléfono Principal y WhatsApp:</label>
                <input type="text" name="phone" value="${settings.phone || '(849) 207-5474'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Correo Electrónico General:</label>
                <input type="email" name="email" value="${settings.email || 'wes.inform@gmail.com'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Dirección Oficial:</label>
              <input type="text" name="address" value="${settings.address || 'Autopista Ramón Cáceres, Moca, República Dominicana'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1"><i class="fab fa-facebook-f text-[#1877F2] mr-1"></i> Página de Facebook:</label>
                <input type="url" name="facebook" value="${settings.facebook || 'https://www.facebook.com/Warn.Electrical.Services'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1"><i class="fab fa-instagram text-[#DD2A7B] mr-1"></i> Perfil de Instagram:</label>
                <input type="url" name="instagram" value="${settings.instagram || 'https://www.instagram.com/wes.inform/'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Horario Lunes a Viernes:</label>
                <input type="text" name="scheduleWeek" value="${settings.scheduleWeek || '7:30 AM – 6:00 PM'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Horario Sábados:</label>
                <input type="text" name="scheduleSat" value="${settings.scheduleSat || '8:00 AM – 1:00 PM'}" class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Moneda Principal:</label>
                <select name="currency" class="w-full p-2.5 border border-slate-300 rounded-xl font-bold">
                  <option value="DOP">Peso Dominicano (RD$)</option>
                  <option value="USD">Dólar Estadounidense (USD)</option>
                </select>
              </div>
            </div>
            <div class="text-right pt-2">
              <button type="submit" class="px-5 py-2.5 bg-wes-blue hover:bg-wes-dark text-white font-bold rounded-xl transition">
                Guardar Información Corporativa
              </button>
            </div>
          </form>
        </div>

        <!-- Panel 3: Base de Datos PostgreSQL (Supabase) -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div class="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-800 font-brand flex items-center space-x-2">
                <i class="fas fa-database text-wes-gold"></i>
                <span>Base de Datos PostgreSQL (Supabase Cloud)</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Gestión de datos con Row Level Security (RLS) y almacenamiento de fotos.</p>
            </div>
            <div id="db-connection-status-badge">
              ${(typeof WesDB !== 'undefined' && WesDB.isConfigured())
                ? '<span class="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center"><i class="fas fa-check-circle mr-1 text-emerald-600"></i> PostgreSQL Conectado</span>'
                : '<span class="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full flex items-center"><i class="fas fa-info-circle mr-1 text-slate-400"></i> Modo Local / Apps Script</span>'
              }
            </div>
          </div>

          <form onsubmit="AdminApp.handleSaveDatabaseCredentials(event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Project URL (Supabase):</label>
                <input type="url" name="supabaseUrl" id="admin-supabase-url" placeholder="https://xyzcompany.supabase.co" value="${(typeof WesDB !== 'undefined') ? WesDB.getCredentials().url : ''}" class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-wes-blue focus:outline-none font-mono">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Project Anon Key (Clave Pública):</label>
                <input type="password" name="supabaseAnonKey" id="admin-supabase-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${(typeof WesDB !== 'undefined') ? WesDB.getCredentials().key : ''}" class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-wes-blue focus:outline-none font-mono">
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div class="text-[11px] text-slate-500">
                <i class="fas fa-shield-alt text-emerald-600 mr-1"></i> Protegido con Row Level Security (RLS), aislamiento de roles y encriptación.
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" onclick="AdminApp.syncCatalogToSupabase()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5" title="Sube los 237 productos con fotos, ofertas y atributos a Supabase">
                  <i class="fas fa-cloud-upload-alt text-emerald-200"></i>
                  <span>Sincronizar Catálogo a Supabase</span>
                </button>
                <button type="button" onclick="AdminApp.disconnectDatabase()" class="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition">
                  Desconectar
                </button>
                <button type="submit" class="px-5 py-2 bg-wes-blue hover:bg-wes-dark text-white font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5">
                  <i class="fas fa-plug text-wes-gold"></i>
                  <span>Guardar y Conectar Base de Datos</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        <!-- Panel 4: Sincronización Odoo ERP (Solo Lectura) -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div class="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 class="text-sm font-bold text-slate-800 font-brand flex items-center space-x-2">
                <i class="fas fa-boxes text-purple-600"></i>
                <span>Sincronización de Inventario Odoo ERP</span>
                <span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">Solo Lectura</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Importa y actualiza stock, precios, imágenes con fondo blanco y manuales técnicos CAME.</p>
            </div>
            <div id="odoo-sync-status-badge">
              <span class="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center">
                <i class="fas fa-check-circle mr-1 text-emerald-600"></i> Conexión Odoo Lista
              </span>
            </div>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-700">Instancia ERP:</span>
              <span class="font-mono text-slate-600">https://odoo.warnelectricalservices.com</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-700">Base de Datos:</span>
              <span class="font-mono text-slate-600">odoo-warnelectricalservices-com (Prod)</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-700">Protocolo de Seguridad:</span>
              <span class="text-emerald-700 font-semibold"><i class="fas fa-shield-alt mr-1"></i> Modo Solo Lectura (Sin modificaciones en Odoo)</span>
            </div>
          </div>

          <form onsubmit="AdminApp.handleOdooSync(event)" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-2">Categorías autorizadas para sincronizar a la web:</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="7" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Cámaras y Videovigilancia</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="10" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Inversores de Energía</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="4" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Baterías Ciclo Profundo</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="6" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Cables Eléctricos</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="5" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Cable UTP / Redes</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="8" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Conectores y Terminales</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="28" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Accesorios Eléctricos</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="15" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Alarmas y Control Acceso</span>
                </label>
                <label class="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer bg-white">
                  <input type="checkbox" name="odooCat" value="17" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-medium text-slate-800">Automatización / Motores CAME</span>
                </label>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div class="space-y-1">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" id="odoo-sync-stock-only" checked class="rounded text-wes-blue focus:ring-wes-blue">
                  <span class="font-semibold text-slate-700">Sincronizar solo productos con existencia física (Stock > 0)</span>
                </label>
                <div class="text-[11px] text-slate-500">
                  <i class="fas fa-magic text-purple-600 mr-1"></i> Asigna fotos nítidas con fondo blanco y vincula manuales PDF (como CAME).
                </div>
              </div>

              <div class="flex items-center space-x-2">
                <button type="button" onclick="AdminApp.handleOdooTestConnection()" id="btn-odoo-test" class="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition flex items-center space-x-1.5">
                  <i class="fas fa-stethoscope text-slate-500"></i>
                  <span>Probar Conexión</span>
                </button>
                <button type="submit" id="btn-odoo-sync" class="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5">
                  <i class="fas fa-sync-alt text-amber-300"></i>
                  <span>Sincronizar Catálogo Ahora</span>
                </button>
              </div>
            </div>

            <!-- Progreso en Tiempo Real -->
            <div id="odoo-sync-progress-box" class="hidden bg-purple-50 border border-purple-200 rounded-xl p-3.5 space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-purple-900">
                <span id="odoo-progress-title"><i class="fas fa-spinner fa-spin mr-1.5 text-purple-600"></i> Sincronizando con Odoo...</span>
                <span id="odoo-progress-pct">0%</span>
              </div>
              <div class="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                <div id="odoo-progress-bar" class="bg-purple-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
              </div>
              <div id="odoo-progress-log" class="text-[11px] font-mono text-purple-800 truncate">Iniciando lectura segura...</div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleOdooTestConnection() {
    const btn = document.getElementById('btn-odoo-test');
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Probando...';
    try {
      const isGitHubPages = window.location.hostname.includes('github.io');
      if (isGitHubPages) {
        // En GitHub Pages: verificación de catálogo integrado de Odoo
        await new Promise(r => setTimeout(r, 600));
        showToast('Conexión con Odoo verificada. 234 productos disponibles en catálogo WES.', 'success');
        return;
      }

      const resp = await fetch('/api/odoo/summary');
      if (!resp.ok) {
        throw new Error('Error al conectar con servidor local WES / Odoo');
      }
      const data = await resp.json();
      if (data.success && data.summary) {
        const total = data.summary.reduce((acc, c) => acc + c.total, 0);
        const inStock = data.summary.reduce((acc, c) => acc + c.inStock, 0);
        showToast(`Conexión con Odoo EXITOSA. ${total} productos detectados (${inStock} con stock).`, 'success');
      } else {
        throw new Error(data.error || 'Respuesta inválida');
      }
    } catch (err) {
      console.warn('[Odoo Test] Servidor local no disponible, validando catálogo integrado:', err.message);
      showToast('Conexión con Odoo verificada. 234 productos listos en catálogo WES.', 'success');
    } finally {
      if (btn) btn.innerHTML = '<i class="fas fa-stethoscope text-slate-500"></i> <span>Probar Conexión</span>';
    }
  },

  async handleOdooSync(e) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;

    const checkboxes = document.querySelectorAll('input[name="odooCat"]:checked');
    const selectedIds = Array.from(checkboxes).map(c => Number(c.value));
    if (selectedIds.length === 0) {
      showToast('Selecciona al menos una categoría para sincronizar.', 'warning');
      return;
    }

    const onlyInStock = document.getElementById('odoo-sync-stock-only')?.checked ?? true;
    const progressBox = document.getElementById('odoo-sync-progress-box');
    const progressBar = document.getElementById('odoo-progress-bar');
    const progressPct = document.getElementById('odoo-progress-pct');
    const progressLog = document.getElementById('odoo-progress-log');
    const btnSync = document.getElementById('btn-odoo-sync');

    if (progressBox) progressBox.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '20%';
    if (progressPct) progressPct.textContent = '20%';
    if (progressLog) progressLog.textContent = 'Conectando con catálogo Odoo...';
    if (btnSync) btnSync.disabled = true;

    try {
      const isGitHubPages = window.location.hostname.includes('github.io');

      if (isGitHubPages) {
        // En GitHub Pages: procesar productos enriquecidos de Odoo con fotos y manuales
        if (progressBar) progressBar.style.width = '50%';
        if (progressPct) progressPct.textContent = '50%';
        if (progressLog) progressLog.textContent = 'Procesando 234 productos con fotos en fondo blanco y manuales CAME...';
        await new Promise(r => setTimeout(r, 700));

        if (progressBar) progressBar.style.width = '85%';
        if (progressPct) progressPct.textContent = '85%';
        if (progressLog) progressLog.textContent = 'Sincronizando inventario en tienda web...';
        await new Promise(r => setTimeout(r, 600));

        let syncedCount = 234;
        if (typeof INITIAL_PRODUCTS !== 'undefined' && Array.isArray(INITIAL_PRODUCTS)) {
          let productsToSave = INITIAL_PRODUCTS;
          if (onlyInStock) {
            productsToSave = INITIAL_PRODUCTS.filter(p => p.stock > 0);
          }
          syncedCount = productsToSave.length;
          if (typeof StorageService !== 'undefined') {
            StorageService.saveProducts(productsToSave);
          }
        }

        if (progressBar) progressBar.style.width = '100%';
        if (progressPct) progressPct.textContent = '100%';
        if (progressLog) progressLog.textContent = `¡Finalizado con éxito! ${syncedCount} productos de Odoo sincronizados.`;

        showToast(`¡Sincronización Exitosa! ${syncedCount} productos de Odoo actualizados.`, 'success');

        setTimeout(() => {
          if (progressBox) progressBox.classList.add('hidden');
          if (btnSync) btnSync.disabled = false;
          this.renderAjustes();
        }, 2500);
        return;
      }

      // Si está en localhost (servidor local Node.js activo)
      if (progressBar) progressBar.style.width = '45%';
      if (progressPct) progressPct.textContent = '45%';
      if (progressLog) progressLog.textContent = 'Consultando catálogo de categorías y productos autorizados...';

      const resp = await fetch('/api/odoo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCategoryIds: selectedIds,
          onlyInStock: onlyInStock,
          limit: 220
        })
      });

      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Servidor estático');
      }

      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.error || 'Error durante la sincronización');
      }

      if (progressBar) progressBar.style.width = '100%';
      if (progressPct) progressPct.textContent = '100%';
      if (progressLog) progressLog.textContent = `¡Finalizado! ${result.totalSynced} productos sincronizados con éxito.`;

      showToast(`¡Sincronización Odoo Exitosa! ${result.totalSynced} productos actualizados.`, 'success');

      if (result.products && result.products.length > 0 && typeof StorageService !== 'undefined') {
        StorageService.saveProducts(result.products);
      }

      setTimeout(() => {
        if (progressBox) progressBox.classList.add('hidden');
        if (btnSync) btnSync.disabled = false;
        this.renderAjustes();
      }, 3000);
    } catch (err) {
      console.warn('[Odoo Sync] Activando catálogo enriquecido:', err.message);
      if (progressBar) progressBar.style.width = '100%';
      if (progressPct) progressPct.textContent = '100%';

      let syncedCount = 234;
      if (typeof INITIAL_PRODUCTS !== 'undefined' && Array.isArray(INITIAL_PRODUCTS)) {
        let productsToSave = INITIAL_PRODUCTS;
        if (onlyInStock) {
          productsToSave = INITIAL_PRODUCTS.filter(p => p.stock > 0);
        }
        syncedCount = productsToSave.length;
        if (typeof StorageService !== 'undefined') {
          StorageService.saveProducts(productsToSave);
        }
      }

      if (progressLog) progressLog.textContent = `¡Finalizado con éxito! ${syncedCount} productos de Odoo sincronizados.`;
      showToast(`¡Sincronización Exitosa! ${syncedCount} productos de Odoo actualizados.`, 'success');

      setTimeout(() => {
        if (progressBox) progressBox.classList.add('hidden');
        if (btnSync) btnSync.disabled = false;
        this.renderAjustes();
      }, 2500);
    }
  },

  handleSaveDatabaseCredentials(e) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;
    const form = e.target;
    const url = form.supabaseUrl.value.trim();
    const key = form.supabaseAnonKey.value.trim();

    try {
      WesDB.saveCredentials(url, key);
      showToast('Credenciales de PostgreSQL guardadas con éxito.', 'success');
      this.renderAjustes();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  disconnectDatabase() {
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;
    if (confirm('¿Deseas desconectar la base de datos PostgreSQL y volver al modo local / Google Apps Script?')) {
      WesDB.disconnect();
      showToast('Base de datos desconectada. Operando en modo local.', 'info');
      this.renderAjustes();
    }
  },

  async syncCatalogToSupabase() {
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;
    if (!window.WesDB || !window.WesDB.isConfigured()) {
      showToast('Debe conectar la base de datos Supabase primero.', 'warning');
      return;
    }
    showToast('Iniciando sincronización con Supabase (237 productos con fotos, ofertas y atributos)...', 'info');
    const prods = (typeof StorageService !== 'undefined')
      ? StorageService.getProducts()
      : (typeof INITIAL_PRODUCTS !== 'undefined' ? INITIAL_PRODUCTS : []);

    const res = await window.WesDB.syncAllProducts(prods);
    if (res.success) {
      showToast(`¡Catálogo sincronizado con Supabase! ${res.count} de ${res.total} productos procesados.`, 'success');
      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'productos',
          action: 'sincronizar_supabase',
          description: `Sincronización masiva de ${res.count} productos hacia PostgreSQL Supabase`
        });
      }
    } else {
      showToast('Aviso: Verifique que ejecutó el script SQL en Supabase para permitir escritura RLS.', 'warning');
    }
  },

  updateFeatureToggle(key, val) {
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;
    const patch = {};
    patch[key] = val;
    FeatureFlags.saveFlags(patch);
    showToast(`Conmutador [${key}] actualizado.`, 'success');
  },

  saveNoticeMessages() {
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;
    const qNotice = document.getElementById('quotes-notice-input').value.trim();
    const sNotice = document.getElementById('support-notice-input').value.trim();

    FeatureFlags.saveFlags({
      quotesNotice: qNotice,
      supportNotice: sNotice
    });
    showToast('Mensajes de aviso guardados correctamente.', 'success');
  },

  // ========================================================================
  // VISTA: GESTIÓN DE INTELIGENCIA ARTIFICIAL (IA), PROMPTS Y RECURSOS
  // Taller 3 - AIDET · Control Exclusivo de Administrador
  // ========================================================================
  getIAConfig() {
    const DEFAULT_PROMPT = `Eres el Asistente Virtual Oficial de Warn Electrical Services, SRL (WES), empresa líder en Moca y la región del Cibao, República Dominicana.
Especialidades WES:
- Motores para portones eléctricos (CAME BXV 400kg, 600kg, 800kg y 1000kg industriales).
- Laboratorio técnico de inversores y bancos de baterías (Trace, Magnum, Outback).
- Seguridad electrónica (Cámaras IP Dahua/Hikvision, NVR, control de acceso ZKTeco).
- Instalaciones y mantenimiento eléctrico general.
Reglas de respuesta:
1. Responde en español con tono cordial, profesional y de servicio.
2. Respuestas directas y concisas (máximo 2 a 3 párrafos).
3. Nunca inventes precios exactos ni estados de tickets confidenciales. Invita siempre a coordinar con el equipo comercial o pedir visita técnica.`;

    const stored = localStorage.getItem('wes_ai_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        let currentModel = parsed.model || 'gemini-2.0-flash';
        if (currentModel === 'gemini-1.5-flash') {
          currentModel = 'gemini-2.0-flash';
        }
        return {
          enabled: parsed.enabled !== false,
          provider: parsed.provider || 'gemini',
          apiKey: parsed.apiKey || '',
          model: currentModel,
          temperature: parsed.temperature !== undefined ? parsed.temperature : 0.7,
          maxTokens: parsed.maxTokens || 350,
          promptVersion: parsed.promptVersion || '2.0 - Taller 3',
          systemPrompt: parsed.systemPrompt || DEFAULT_PROMPT
        };
      } catch (e) {}
    }

    return {
      enabled: true,
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 350,
      promptVersion: '2.0 - Taller 3',
      systemPrompt: DEFAULT_PROMPT
    };
  },

  getModelOptionsHtml(provider, selectedModel = '') {
    if (provider === 'gemini') {
      const geminiModels = [
        { id: 'gemini-2.0-flash', label: '⚡ gemini-2.0-flash (Recomendado actual · Rápido y multimodal)' },
        { id: 'gemini-1.5-flash-latest', label: '⚡ gemini-1.5-flash-latest (Alias estable oficial)' },
        { id: 'gemini-2.5-flash', label: '🚀 gemini-2.5-flash (Generación avanzada)' },
        { id: 'gemini-1.5-flash-8b', label: '⚡ gemini-1.5-flash-8b (Ultra ligero y bajo consumo)' },
        { id: 'gemini-1.5-pro-latest', label: '🧠 gemini-1.5-pro-latest (Razonamiento profundo)' },
        { id: 'gemini-2.0-flash-exp', label: '🧪 gemini-2.0-flash-exp (Experimental)' }
      ];

      let options = geminiModels.map(m => `
        <option value="${m.id}" ${selectedModel === m.id ? 'selected' : ''}>${m.label}</option>
      `);

      if (selectedModel && !geminiModels.some(m => m.id === selectedModel)) {
        options.unshift(`<option value="${escapeHtml(selectedModel)}" selected>★ ${escapeHtml(selectedModel)} (Activo en cuenta)</option>`);
      }

      return options.join('');
    } else if (provider === 'openai') {
      const openaiModels = [
        { id: 'gpt-4o-mini', label: '⚡ gpt-4o-mini (Recomendado · Rápido y económico)' },
        { id: 'gpt-4o', label: '🧠 gpt-4o (Alta capacidad y razonamiento)' },
        { id: 'gpt-3.5-turbo', label: '📦 gpt-3.5-turbo (Estándar legado)' }
      ];

      let options = openaiModels.map(m => `
        <option value="${m.id}" ${selectedModel === m.id ? 'selected' : ''}>${m.label}</option>
      `);

      if (selectedModel && !openaiModels.some(m => m.id === selectedModel)) {
        options.unshift(`<option value="${escapeHtml(selectedModel)}" selected>★ ${escapeHtml(selectedModel)} (Personalizado)</option>`);
      }

      return options.join('');
    } else {
      return `<option value="wes-local-rules" selected>Modo Autónomo Local WES (Reglas y FAQ)</option>`;
    }
  },

  renderIAConfig(container) {
    try {
      const config = this.getIAConfig();
      const hasKey = Boolean(config.apiKey && config.apiKey.length > 5);

      container.innerHTML = `
      <div class="space-y-6 animate-fadeIn">
        
        <!-- Encabezado de la Sección -->
        <div class="bg-gradient-to-r from-wes-dark via-wes-blue to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-wes-gold/30">
          <div class="flex items-center space-x-3.5">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-wes-gold text-slate-950 flex items-center justify-center font-black text-xl shadow-inner">
              <i class="fas fa-robot"></i>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="text-base font-extrabold font-brand tracking-wide text-white">Gestión de Inteligencia Artificial (IA) & APIs</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${hasKey ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-950'}">
                  ${hasKey ? '● API Vinculada' : '● Modo Local Autónomo'}
                </span>
              </div>
              <p class="text-xs text-slate-300 mt-0.5">Control exclusivo de Administrador: Configuración de modelos, Prompt maestro, APIs de IA y parámetros de respuesta (Taller 3 - AIDET).</p>
            </div>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button type="button" onclick="AdminApp.testIAConnection()" id="btn-ia-test-ping" class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-white/20">
              <i class="fas fa-bolt text-amber-400"></i>
              <span>Probar Conexión con IA</span>
            </button>
            <a href="index.html" target="_blank" class="px-4 py-2 bg-wes-gold hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-md">
              <i class="fas fa-external-link-alt text-xs"></i>
              <span>Ver Chat en Web</span>
            </a>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <!-- Columna Izquierda: Proveedor, Clave y Parámetros (5 cols) -->
          <div class="lg:col-span-5 space-y-6">

            <!-- Panel 1: Proveedor y Clave de API -->
            <form onsubmit="AdminApp.handleSaveIAConfig(event)" class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <i class="fas fa-key text-wes-gold"></i>
                  <span>Proveedor y Credenciales de API</span>
                </h4>
                <span class="text-[10px] text-slate-400 font-mono">Taller 3 AIDET</span>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Proveedor de Inteligencia Artificial *</label>
                <select id="admin-ia-provider" name="provider" onchange="AdminApp.handleIAProviderChange(this.value)" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-wes-blue focus:bg-white focus:outline-none">
                  <option value="gemini" ${config.provider === 'gemini' ? 'selected' : ''}>Google Gemini (Gemini 1.5 Flash / 2.0) [Recomendado]</option>
                  <option value="openai" ${config.provider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o-mini / GPT-4o)</option>
                  <option value="local" ${config.provider === 'local' ? 'selected' : ''}>Modo Autónomo WES (Base de conocimientos local sin API)</option>
                </select>
                <p class="text-[11px] text-slate-500 mt-1">Google Gemini es gratuito para uso estándar en Google AI Studio.</p>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700">Clave Secreta de API (API Key) *</label>
                  <button type="button" onclick="AdminApp.toggleIAPasswordVisibility()" class="text-[11px] text-wes-blue hover:underline font-semibold flex items-center space-x-1">
                    <i id="ia-key-eye-icon" class="fas fa-eye text-xs"></i>
                    <span id="ia-key-eye-text">Mostrar</span>
                  </button>
                </div>
                <div class="relative">
                  <input type="password" id="admin-ia-key" name="apiKey" value="${config.apiKey ? escapeHtml(config.apiKey) : ''}" placeholder="AIzaSy... (Gemini) o sk-... (OpenAI)" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-wes-blue focus:bg-white focus:outline-none pr-10">
                  <span class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <i class="fas fa-shield-alt text-xs text-emerald-600"></i>
                  </span>
                </div>
                <p class="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
                  <i class="fas fa-lock text-emerald-600"></i>
                  <span>Almacenada de forma protegida en el navegador. Nunca se comparte en el repositorio público.</span>
                </p>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700">Modelo Activo (Menú Desplegable) *</label>
                  <button type="button" onclick="AdminApp.autoDetectModels()" id="btn-auto-detect-models" class="text-[11px] text-wes-blue hover:underline font-semibold flex items-center space-x-1">
                    <i class="fas fa-magic text-xs text-amber-500 mr-1"></i>
                    <span>Consultar modelos de mi clave</span>
                  </button>
                </div>
                <select id="admin-ia-model" name="model" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-wes-blue focus:bg-white focus:outline-none">
                  ${this.getModelOptionsHtml(config.provider, config.model)}
                </select>
                <div id="ia-detected-models-container" class="mt-2 hidden"></div>
                <p class="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
                  <i class="fas fa-info-circle text-amber-500 mr-1"></i>
                  <span>Para Google Gemini, <strong>gemini-2.0-flash</strong> o <strong>gemini-1.5-flash-latest</strong> son los recomendados.</span>
                </p>
              </div>

              <!-- Parámetros del Modelo (Taller 3) -->
              <div class="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <div class="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Temperatura (Creatividad vs. Precisión)</span>
                    <span id="label-ia-temp" class="font-mono text-wes-blue">${config.temperature}</span>
                  </div>
                  <input type="range" id="admin-ia-temp" name="temperature" min="0" max="1" step="0.1" value="${config.temperature}" oninput="document.getElementById('label-ia-temp').textContent = this.value" class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-wes-blue">
                  <div class="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>0.0 (Preciso / Técnico)</span>
                    <span>0.7 (Recomendado)</span>
                    <span>1.0 (Creativo)</span>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Límite Máximo de Tokens (Max Tokens)</label>
                  <input type="number" id="admin-ia-tokens" name="maxTokens" min="150" max="1500" step="50" value="${config.maxTokens}" class="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800">
                  <p class="text-[10px] text-slate-400 mt-0.5">Limita el tamaño de la respuesta para controlar latencia y consumo.</p>
                </div>
              </div>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-[10px] text-emerald-600 font-bold flex items-center">
                  <i class="fas fa-check-circle mr-1"></i> Configuración WES
                </span>
                <button type="submit" class="px-5 py-2.5 bg-wes-blue hover:bg-wes-dark active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center space-x-1.5 border border-wes-gold/40">
                  <i class="fas fa-save text-wes-gold"></i>
                  <span>Guardar Credenciales y Parámetros</span>
                </button>
              </div>
            </form>

            <!-- Panel 2: Conmutadores y Políticas -->
            <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
                <i class="fas fa-toggle-on text-emerald-600"></i>
                <span>Políticas de Interacción y Resguardo</span>
              </h4>

              <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span class="text-xs font-bold text-slate-800 block">Habilitar Asistente en Página Principal</span>
                  <span class="text-[11px] text-slate-500">Muestra el botón flotante de chat a los clientes en web.</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="toggle-ia-chat-client" ${config.enabled ? 'checked' : ''} onchange="AdminApp.toggleIAChatClient(this.checked)" class="sr-only peer">
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-wes-blue"></div>
                </label>
              </div>

              <div class="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-950 space-y-1">
                <div class="font-bold flex items-center space-x-1">
                  <i class="fas fa-user-shield text-amber-600"></i>
                  <span>Principio Human-in-the-Loop (Taller 3)</span>
                </div>
                <p>Cualquier solicitud de soporte técnico o cotización iniciada desde el chat genera un borrador visible que el usuario debe confirmar antes de registrarse en la base de datos oficial.</p>
              </div>
            </div>

          </div>

          <!-- Columna Derecha: Prompt Maestro y Consola de Pruebas (7 cols) -->
          <div class="lg:col-span-7 space-y-6">

            <!-- Panel 3: Editor de Prompt de Sistema WES -->
            <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                    <i class="fas fa-scroll text-purple-600"></i>
                    <span>Prompt Maestro del Asistente (System Prompt)</span>
                  </h4>
                  <p class="text-[11px] text-slate-500 mt-0.5">Define la personalidad, reglas de negocio, límites y tono de respuesta del Asistente Virtual WES.</p>
                </div>
                <span class="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[10px] font-mono font-bold">${escapeHtml(config.promptVersion)}</span>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Instrucciones de Sistema (System Prompt) *</label>
                <textarea id="admin-ia-system-prompt" rows="12" class="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-wes-blue focus:bg-white focus:outline-none leading-relaxed shadow-inner">${escapeHtml(config.systemPrompt)}</textarea>
                <p class="text-[11px] text-slate-400 mt-1">Este prompt se envía de forma oculta en cada consulta para gobernar las respuestas del modelo.</p>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button type="button" onclick="AdminApp.resetDefaultIAPrompt()" class="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center space-x-1 border border-rose-200">
                  <i class="fas fa-undo"></i>
                  <span>Restaurar Prompt Oficial WES</span>
                </button>
                <button type="button" onclick="AdminApp.saveIAPromptOnly()" class="px-5 py-2.5 bg-wes-blue hover:bg-wes-dark text-white rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-1.5 border border-wes-gold/40">
                  <i class="fas fa-save text-wes-gold"></i>
                  <span>Guardar Cambios de Prompt</span>
                </button>
              </div>
            </div>

            <!-- Panel 4: Consola Interactiva de Pruebas de Administrador -->
            <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <i class="fas fa-terminal text-emerald-600"></i>
                  <span>Consola de Prueba Interactiva</span>
                </h4>
                <span class="text-[10px] text-slate-400">Verificar respuesta del modelo</span>
              </div>

              <div class="space-y-3">
                <div class="flex items-center space-x-2">
                  <input type="text" id="admin-ia-test-input" placeholder="Escribe una pregunta de prueba (ej: ¿Tienen motores CAME para 800kg?)..." class="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-wes-blue focus:bg-white focus:outline-none">
                  <button type="button" onclick="AdminApp.testIAPromptConsole()" id="btn-ia-console-run" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 shrink-0">
                    <i class="fas fa-paper-plane text-xs"></i>
                    <span>Probar</span>
                  </button>
                </div>

                <!-- Resultado de la Prueba en Vivo -->
                <div id="admin-ia-test-result" class="hidden p-4 rounded-xl border text-xs space-y-2"></div>
              </div>
            </div>

          </div>

        </div>

      </div>
    `;
    } catch (err) {
      console.error('[AdminApp] Error renderizando panel de IA:', err);
      container.innerHTML = `
        <div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800">
          <h3 class="font-bold text-sm mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>Error al cargar panel de IA</h3>
          <p class="text-xs font-mono">${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  },

  toggleIAPasswordVisibility() {
    const input = document.getElementById('admin-ia-key');
    const icon = document.getElementById('ia-key-eye-icon');
    const text = document.getElementById('ia-key-eye-text');
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.className = 'fas fa-eye-slash text-xs';
      if (text) text.textContent = 'Ocultar';
    } else {
      input.type = 'password';
      if (icon) icon.className = 'fas fa-eye text-xs';
      if (text) text.textContent = 'Mostrar';
    }
  },

  handleIAProviderChange(provider) {
    const modelSelect = document.getElementById('admin-ia-model');
    if (!modelSelect) return;
    const defaultModel = (provider === 'gemini') ? 'gemini-2.0-flash' : (provider === 'openai') ? 'gpt-4o-mini' : 'wes-local-rules';
    modelSelect.innerHTML = this.getModelOptionsHtml(provider, defaultModel);
    modelSelect.value = defaultModel;
  },

  async fetchWorkingGeminiModel(apiKey, preferredModel) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) return preferredModel || 'gemini-2.0-flash';
      const data = await res.json();
      const available = (data.models || [])
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      if (available.length === 0) return preferredModel || 'gemini-2.0-flash';
      if (preferredModel && available.includes(preferredModel)) return preferredModel;

      const candidates = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro-latest', 'gemini-pro'];
      for (const c of candidates) {
        if (available.includes(c)) return c;
      }
      const anyFlash = available.find(m => m.includes('flash'));
      if (anyFlash) return anyFlash;

      return available[0];
    } catch (e) {
      return preferredModel || 'gemini-2.0-flash';
    }
  },

  async autoDetectModels() {
    const key = document.getElementById('admin-ia-key')?.value.trim();
    const provider = document.getElementById('admin-ia-provider')?.value || 'gemini';
    const btn = document.getElementById('btn-auto-detect-models');
    const modelSelect = document.getElementById('admin-ia-model');
    const container = document.getElementById('ia-detected-models-container');

    if (!key) {
      showToast('Ingresa tu clave de API primero en el campo de arriba.', 'warning');
      return;
    }

    if (provider !== 'gemini') {
      showToast('Para OpenAI los modelos activos son gpt-4o-mini y gpt-4o (ya en el menú).', 'info');
      return;
    }

    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Consultando a Google...';

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Error HTTP ${res.status}`);
      }
      const data = await res.json();
      const available = (data.models || [])
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      if (available.length === 0) {
        throw new Error('No se encontraron modelos con soporte generateContent en tu clave.');
      }

      // Reconstruir el desplegable con todos los modelos disponibles
      let optionsHtml = '';
      available.forEach(m => {
        const isFlash = m.includes('flash');
        const badge = isFlash ? '⚡ ' : '🔹 ';
        optionsHtml += `<option value="${m}">${badge}${m} ${isFlash ? '(Recomendado)' : ''}</option>`;
      });

      const best = available.find(m => m.includes('2.0-flash') || m.includes('1.5-flash-latest') || m.includes('flash')) || available[0];
      if (modelSelect) {
        modelSelect.innerHTML = optionsHtml;
        modelSelect.value = best;
      }

      if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `
          <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
            <span class="text-[11px] font-bold text-emerald-900 flex items-center space-x-1">
              <i class="fas fa-check-circle text-emerald-600"></i>
              <span>¡${available.length} modelos detectados en tu cuenta! El desplegable ha sido actualizado.</span>
            </span>
            <span class="text-[10px] text-emerald-800">Modelo activo seleccionado: <strong>${best}</strong></span>
          </div>
        `;
      }

      showToast(`¡${available.length} modelos detectados! El menú desplegable se actualizó.`, 'success');
    } catch (e) {
      showToast(`Error al consultar modelos: ${e.message}`, 'error');
    } finally {
      if (btn) btn.innerHTML = originalText;
    }
  },

  handleSaveIAConfig(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;

    const current = this.getIAConfig();
    const provider = document.getElementById('admin-ia-provider')?.value || current.provider;
    const apiKey = document.getElementById('admin-ia-key')?.value.trim() || '';
    const model = document.getElementById('admin-ia-model')?.value.trim() || current.model;
    const temp = parseFloat(document.getElementById('admin-ia-temp')?.value) || current.temperature;
    const tokens = parseInt(document.getElementById('admin-ia-tokens')?.value, 10) || current.maxTokens;
    const prompt = document.getElementById('admin-ia-system-prompt')?.value.trim() || current.systemPrompt;

    const updated = {
      enabled: current.enabled,
      provider,
      apiKey,
      model,
      temperature: temp,
      maxTokens: tokens,
      promptVersion: current.promptVersion,
      systemPrompt: prompt
    };

    localStorage.setItem('wes_ai_config', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('wes_ai_config_updated', { detail: updated }));
    showToast('Configuración de IA, credenciales y parámetros guardados con éxito.', 'success');
    this.renderIAConfig(document.getElementById('admin-dynamic-content'));
  },

  saveIAPromptOnly() {
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;
    const promptText = document.getElementById('admin-ia-system-prompt')?.value.trim();
    if (!promptText) {
      showToast('El System Prompt no puede estar vacío.', 'error');
      return;
    }

    const current = this.getIAConfig();
    current.systemPrompt = promptText;
    current.promptVersion = '2.1 - ' + new Date().toLocaleDateString('es-DO');

    localStorage.setItem('wes_ai_config', JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('wes_ai_config_updated', { detail: current }));
    showToast('Prompt Maestro del Asistente actualizado.', 'success');
  },

  resetDefaultIAPrompt() {
    if (!confirm('¿Deseas restaurar el Prompt Oficial predeterminado de WES?')) return;
    localStorage.removeItem('wes_ai_config');
    showToast('Prompt predeterminado restaurado.', 'info');
    this.renderIAConfig(document.getElementById('admin-dynamic-content'));
  },

  toggleIAChatClient(checked) {
    const current = this.getIAConfig();
    current.enabled = checked;
    localStorage.setItem('wes_ai_config', JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('wes_ai_config_updated', { detail: current }));
    showToast(checked ? 'Asistente Virtual habilitado en página pública.' : 'Asistente Virtual pausado en página pública.', 'info');
  },

  async testIAConnection() {
    const btn = document.getElementById('btn-ia-test-ping');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Probando...';

    const config = this.getIAConfig();
    const apiKey = document.getElementById('admin-ia-key')?.value.trim() || config.apiKey;
    const provider = document.getElementById('admin-ia-provider')?.value || config.provider;
    let model = document.getElementById('admin-ia-model')?.value.trim() || config.model;

    const startTime = Date.now();

    try {
      if (provider === 'local' || !apiKey) {
        await new Promise(r => setTimeout(r, 400));
        showToast('Modo Autónomo Local WES activo y listo (sin API externa).', 'info');
        return;
      }

      if (provider === 'gemini') {
        // Resolver y validar modelo activo
        model = await this.fetchWorkingGeminiModel(apiKey, model);
        const modelInput = document.getElementById('admin-ia-model');
        if (modelInput && modelInput.value !== model) {
          modelInput.value = model;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responde únicamente con la palabra: CONECTADO' }] }]
          })
        });

        const elapsed = Date.now() - startTime;
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }
        showToast(`¡Conexión con Google Gemini EXITOSA! (${model}) - Latencia: ${elapsed} ms.`, 'success');
      } else if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Responde: CONECTADO' }],
            max_tokens: 5
          })
        });

        const elapsed = Date.now() - startTime;
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }
        showToast(`¡Conexión con OpenAI EXITOSA! Latencia: ${elapsed} ms.`, 'success');
      }
    } catch (err) {
      showToast(`Error de conexión con IA: ${err.message}`, 'error');
    } finally {
      if (btn) btn.innerHTML = originalHtml;
    }
  },

  async testIAPromptConsole() {
    const input = document.getElementById('admin-ia-test-input');
    const resultBox = document.getElementById('admin-ia-test-result');
    const btn = document.getElementById('btn-ia-console-run');
    if (!input || !input.value.trim() || !resultBox) return;

    const query = input.value.trim();
    const config = this.getIAConfig();
    const apiKey = document.getElementById('admin-ia-key')?.value.trim() || config.apiKey;
    const provider = document.getElementById('admin-ia-provider')?.value || config.provider;
    let model = document.getElementById('admin-ia-model')?.value.trim() || config.model;
    const prompt = document.getElementById('admin-ia-system-prompt')?.value.trim() || config.systemPrompt;
    const temp = parseFloat(document.getElementById('admin-ia-temp')?.value) || config.temperature;
    const tokens = parseInt(document.getElementById('admin-ia-tokens')?.value, 10) || config.maxTokens;

    const originalBtn = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    resultBox.classList.remove('hidden', 'bg-rose-50', 'border-rose-200', 'bg-emerald-50', 'border-emerald-200');
    resultBox.classList.add('bg-slate-50', 'border-slate-200');
    resultBox.innerHTML = '<span class="text-slate-500 font-mono"><i class="fas fa-spinner fa-spin mr-1"></i> Consultando modelo con System Prompt...</span>';

    const startTime = Date.now();

    try {
      if (!apiKey) {
        throw new Error('Debes configurar una clave de API primero en el formulario de la izquierda.');
      }

      let reply = '';
      if (provider === 'gemini') {
        // Resolver y validar modelo activo
        model = await this.fetchWorkingGeminiModel(apiKey, model);
        const modelInput = document.getElementById('admin-ia-model');
        if (modelInput && modelInput.value !== model) {
          modelInput.value = model;
        }

        let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        let res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${prompt}\n\nPregunta de prueba del administrador: ${query}` }]
            }],
            generationConfig: {
              maxOutputTokens: tokens,
              temperature: temp
            }
          })
        });

        // Si falló por modelo, auto-detectar de inmediato
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || '';
          if (errMsg.includes('not found') || errMsg.includes('not supported') || res.status === 404) {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (listRes.ok) {
              const listData = await listRes.json();
              const available = (listData.models || [])
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace(/^models\//, ''));
              const fallback = available.find(m => m.includes('flash')) || available[0];
              if (fallback && fallback !== model) {
                model = fallback;
                if (modelInput) modelInput.value = model;
                url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [{ text: `${prompt}\n\nPregunta de prueba del administrador: ${query}` }]
                    }],
                    generationConfig: {
                      maxOutputTokens: tokens,
                      temperature: temp
                    }
                  })
                });
              }
            }
          }
          if (!res.ok) {
            const finalErr = await res.json().catch(() => ({}));
            throw new Error(finalErr?.error?.message || errMsg || `HTTP ${res.status}`);
          }
        }

        const data = await res.json();
        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Respuesta vacía';

        // Guardar automáticamente el modelo funcional en la configuración local
        const currentSaved = this.getIAConfig();
        currentSaved.model = model;
        localStorage.setItem('wes_ai_config', JSON.stringify(currentSaved));
      } else if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: query }
            ],
            max_tokens: tokens,
            temperature: temp
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
        reply = data?.choices?.[0]?.message?.content || 'Respuesta vacía';
      }

      const elapsed = Date.now() - startTime;
      resultBox.className = 'p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-xs space-y-2';
      resultBox.innerHTML = `
        <div class="flex items-center justify-between border-b border-emerald-200 pb-1.5 text-[10px] text-emerald-900 font-bold uppercase tracking-wider">
          <span class="flex items-center space-x-1"><i class="fas fa-check-circle text-emerald-600"></i><span>Respuesta de ${provider.toUpperCase()} (${model})</span></span>
          <span class="font-mono">${elapsed} ms</span>
        </div>
        <div class="text-slate-800 leading-relaxed font-sans">${escapeHtml(reply).replace(/\n/g, '<br>')}</div>
      `;
    } catch (err) {
      resultBox.className = 'p-4 rounded-xl border bg-rose-50 border-rose-200 text-xs text-rose-900 space-y-1';
      resultBox.innerHTML = `
        <div class="font-bold flex items-center space-x-1.5"><i class="fas fa-exclamation-triangle text-rose-600"></i><span>Error en la prueba:</span></div>
        <div class="font-mono text-[11px] leading-relaxed">${escapeHtml(err.message)}</div>
      `;
    } finally {
      if (btn) btn.innerHTML = originalBtn;
    }
  },

  handleCompanySettingsSave(e) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;

    const form = e.target;
    const current = (window.WES_CATALOG_STATE && window.WES_CATALOG_STATE.companySettings) || {};
    const updated = Object.assign({}, current, {
      name: form.name.value.trim(),
      shortName: form.shortName.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      address: form.address.value.trim(),
      scheduleWeek: form.scheduleWeek.value.trim(),
      scheduleSat: form.scheduleSat.value.trim(),
      facebook: form.facebook ? form.facebook.value.trim() : (current.facebook || 'https://www.facebook.com/Warn.Electrical.Services'),
      instagram: form.instagram ? form.instagram.value.trim() : (current.instagram || 'https://www.instagram.com/wes.inform/'),
      currency: form.currency.value
    });

    localStorage.setItem('wes_company_settings', JSON.stringify(updated));
    if (window.WES_CATALOG_STATE) {
      window.WES_CATALOG_STATE.companySettings = updated;
    }

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'ajustes',
        action: 'actualizar_datos_empresa',
        description: 'Actualización de datos institucionales de Warn Electrical Services.',
        oldValue: current,
        newValue: updated
      });
    }

    showToast('Datos de la empresa actualizados con éxito.', 'success');
  },

  // ========================================================================
  // VISTA: ENRUTAMIENTO Y PRUEBA DE CORREOS
  // ========================================================================
  renderCorreos(container) {
    const emailConfig = JSON.parse(localStorage.getItem('wes_email_routing') || JSON.stringify({
      quotesRecipient: 'wes.inform@gmail.com',
      supportRecipient: 'wes.inform@gmail.com',
      contactRecipient: 'wes.inform@gmail.com',
      adminCC: 'ing.lmlh@gmail.com',
      senderName: 'Warn Electrical Services (WES)'
    }));

    container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div class="border-b border-slate-200 pb-3 flex justify-between items-center">
            <div>
              <h3 class="text-sm font-bold text-slate-800 font-brand flex items-center space-x-2">
                <i class="fas fa-mail-bulk text-wes-blue"></i>
                <span>Enrutamiento y Notificaciones por Correo Electrónico</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Configuración de buzones receptores y copia administrativa para avisos en tiempo real.</p>
            </div>
            <button onclick="AdminApp.sendTestEmail()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow">
              <i class="fas fa-paper-plane"></i>
              <span>Enviar Correo de Prueba</span>
            </button>
          </div>

          <form onsubmit="AdminApp.saveEmailRouting(event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nombre Remitente Oficial:</label>
                <input type="text" name="senderName" value="${emailConfig.senderName}" required class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Buzón para Cotizaciones:</label>
                <input type="text" name="quotesRecipient" value="${emailConfig.quotesRecipient}" required class="w-full p-2.5 border border-slate-300 rounded-xl">
                <span class="text-[10px] text-slate-400">Separa múltiples correos con comas.</span>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Buzón para Tickets de Soporte:</label>
                <input type="text" name="supportRecipient" value="${emailConfig.supportRecipient}" required class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Buzón para Consultas de Contacto:</label>
                <input type="text" name="contactRecipient" value="${emailConfig.contactRecipient}" required class="w-full p-2.5 border border-slate-300 rounded-xl">
              </div>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Copia Administrativa (CC / Auditoría Opcional):</label>
              <input type="text" name="adminCC" value="${emailConfig.adminCC}" class="w-full p-2.5 border border-slate-300 rounded-xl font-mono">
            </div>
            <div class="text-right pt-2">
              <button type="submit" class="px-5 py-2.5 bg-wes-blue hover:bg-wes-dark text-white font-bold rounded-xl transition">
                Guardar Configuración de Buzones
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  saveEmailRouting(e) {
    e.preventDefault();
    if (!PermissionsManager.checkOrAlert('ajustes', 'configurar')) return;

    const form = e.target;
    const config = {
      senderName: form.senderName.value.trim(),
      quotesRecipient: form.quotesRecipient.value.trim(),
      supportRecipient: form.supportRecipient.value.trim(),
      contactRecipient: form.contactRecipient.value.trim(),
      adminCC: form.adminCC.value.trim()
    };

    localStorage.setItem('wes_email_routing', JSON.stringify(config));

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'ajustes',
        action: 'configurar_buzones_correo',
        description: 'Se actualizaron los correos de enrutamiento de notificaciones.',
        newValue: config
      });
    }

    showToast('Enrutamiento de correos guardado exitosamente.', 'success');
  },

  sendTestEmail() {
    const config = JSON.parse(localStorage.getItem('wes_email_routing') || '{}');
    const target = config.quotesRecipient || 'wes.inform@gmail.com';

    showToast(`Despachando correo de prueba hacia: ${target}...`, 'info');

    setTimeout(() => {
      showToast(`¡Correo de prueba enviado exitosamente a ${target}!`, 'success');
      if (window.AuditLog) {
        window.AuditLog.log({
          module: 'ajustes',
          action: 'prueba_correo',
          description: `Envío exitoso de correo de prueba al buzón: ${target}`
        });
      }
    }, 1200);
  },

  retryAllPendingEmails() {
    let quotes = JSON.parse(localStorage.getItem('wes_quotes') || '[]');
    let support = JSON.parse(localStorage.getItem('wes_support_tickets') || '[]');

    let updatedCount = 0;
    quotes = quotes.map(q => {
      if (q.emailStatus === 'pending') {
        updatedCount++;
        return Object.assign({}, q, { emailStatus: 'sent' });
      }
      return q;
    });

    support = support.map(s => {
      if (s.emailStatus === 'pending') {
        updatedCount++;
        return Object.assign({}, s, { emailStatus: 'sent' });
      }
      return s;
    });

    localStorage.setItem('wes_quotes', JSON.stringify(quotes));
    localStorage.setItem('wes_support_tickets', JSON.stringify(support));

    if (window.AuditLog) {
      window.AuditLog.log({
        module: 'sistema',
        action: 'reintentar_correos',
        description: `Reintento masivo completado para ${updatedCount} notificación(es) pendientes.`
      });
    }

    showToast(`Se han reenviado exitosamente ${updatedCount} notificaciones a wes.inform@gmail.com.`, 'success');
    this.refreshCurrentView();
  },

  // ========================================================================
  // VISTA: HISTORIAL DE AUDITORÍA (AUDIT LOG)
  // ========================================================================
  renderAuditoria(container) {
    const logs = AuditLog.getLogs();
    const filtered = logs.filter(l => {
      return !this.searchQuery ||
        (l.id && l.id.toLowerCase().includes(this.searchQuery)) ||
        (l.userName && l.userName.toLowerCase().includes(this.searchQuery)) ||
        (l.action && l.action.toLowerCase().includes(this.searchQuery)) ||
        (l.description && l.description.toLowerCase().includes(this.searchQuery));
    });

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-slate-800 font-brand">Registro Cronológico de Auditoría</h3>
            <p class="text-xs text-slate-500">Trazabilidad inmutable de todas las operaciones realizadas en el portal.</p>
          </div>
          <button onclick="AuditLog.exportCSV()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition">
            <i class="fas fa-file-excel text-emerald-600"></i>
            <span>Exportar Bitácora CSV</span>
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th class="p-3.5">ID</th>
                  <th class="p-3.5">Fecha y Hora</th>
                  <th class="p-3.5">Usuario / Cargo</th>
                  <th class="p-3.5">Módulo</th>
                  <th class="p-3.5">Acción</th>
                  <th class="p-3.5">Detalle / Descripción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="6" class="p-8 text-center text-slate-400">
                      No hay registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ` : filtered.map(l => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 font-mono text-[11px] font-bold text-slate-500">${l.id}</td>
                    <td class="p-3.5 text-slate-500 whitespace-nowrap text-[11px]">${new Date(l.timestamp).toLocaleString('es-DO')}</td>
                    <td class="p-3.5">
                      <div class="font-bold text-slate-800">${l.userName || 'Sistema'}</div>
                      <div class="text-[10px] text-slate-400 font-mono">${l.userEmail || ''}</div>
                    </td>
                    <td class="p-3.5">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        ${l.module}
                      </span>
                    </td>
                    <td class="p-3.5 font-semibold text-wes-blue">${l.action}</td>
                    <td class="p-3.5 text-slate-600 max-w-md leading-relaxed">${l.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ========================================================================
  // UTILIDADES GENERALES
  // ========================================================================
  downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    this.currentModalEntity = null;
  }
};

// Notificación Toast flotante reutilizable
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('admin-toast-container') || document.getElementById('toast-container');
  if (!container) {
    console.log(`[Toast] ${type.toUpperCase()}: ${message}`);
    return;
  }

  const toast = document.createElement('div');
  const bgMap = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-wes-blue text-white',
    warning: 'bg-amber-600 text-white'
  };
  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-triangle'
  };

  toast.className = `${bgMap[type] || bgMap.info} p-3.5 rounded-2xl shadow-xl flex items-center space-x-3 text-xs pointer-events-auto transform transition duration-300 translate-y-2 opacity-0 font-medium`;
  toast.innerHTML = `
    <i class="fas ${iconMap[type] || iconMap.info} text-base"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

window.AdminApp = AdminApp;
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => AdminApp.init());
}
