// ==========================================================================
// WARN ELECTRICAL SERVICES, SRL (WES)
// Gestor de Conmutadores Públicos (Feature Toggles) - js/feature_flags.js
// ==========================================================================

const DEFAULT_FEATURE_FLAGS = {
  showPrices: true,
  enableQuotes: true,
  quotesNotice: "Las solicitudes de cotización se encuentran temporalmente pausadas por mantenimiento de inventario. Contáctanos por WhatsApp al (849) 207-5474.",
  enableSupport: true,
  supportNotice: "El módulo de soporte técnico en línea está en calibración. Por favor comunícate directamente al correo wes.inform@gmail.com o vía telefónica.",
  hideOutOfStock: false,
  showFounders: true,
  showMap: true,
  showWhatsAppButton: false,
  activeCategories: [
    "Cámaras de Seguridad",
    "CCTV y Cámaras",
    "camaras",
    "Controles de Acceso",
    "acceso",
    "Cerraduras Inteligentes",
    "cerraduras",
    "Alarmas y Sensores",
    "alarmas",
    "Redes y Conectividad",
    "redes",
    "Energía y Respaldo",
    "energia",
    "Automatización y Domótica",
    "automatizacion",
    "Accesorios de Instalación",
    "Cables & Conectividad",
    "cables",
    "Accesorios",
    "accesorios",
    "grabadores",
    "intercom",
    "otros"
  ]
};

const FeatureFlags = {
  STORAGE_KEY: 'wes_feature_flags_v2',

  getFlags() {
    try {
      const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(this.STORAGE_KEY) : null;
      if (stored) {
        return Object.assign({}, DEFAULT_FEATURE_FLAGS, JSON.parse(stored));
      }
    } catch (e) {
      console.warn('[WES Flags] Error leyendo feature flags de localStorage:', e);
    }
    return Object.assign({}, DEFAULT_FEATURE_FLAGS);
  },

  saveFlags(flags, user = 'Admin') {
    try {
      const current = this.getFlags();
      const updated = Object.assign({}, current, flags);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      }

      // Disparar evento para componentes en la misma pestaña
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wes_flags_changed', { detail: updated }));
      }

      // Registrar en auditoría si el módulo está disponible
      if (typeof window !== 'undefined' && window.AuditLog && typeof window.AuditLog.log === 'function') {
        window.AuditLog.log({
          module: 'ajustes',
          action: 'actualizar_feature_toggles',
          description: 'Se actualizaron los conmutadores de funciones públicas (Feature Flags).',
          oldValue: current,
          newValue: updated
        });
      }

      return updated;
    } catch (e) {
      console.error('[WES Flags] Error guardando feature flags:', e);
      return null;
    }
  },

  isFeatureActive(featureKey) {
    const flags = this.getFlags();
    return Boolean(flags[featureKey]);
  },

  isCategoryActive(categoryName) {
    const flags = this.getFlags();
    if (!flags.activeCategories || !Array.isArray(flags.activeCategories) || flags.activeCategories.length === 0) return true;
    if (!categoryName) return true;

    const normalize = str => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const target = normalize(categoryName);

    return flags.activeCategories.some(cat => {
      const activeNorm = normalize(cat);
      if (activeNorm === target || activeNorm.includes(target) || target.includes(activeNorm)) return true;
      if (target === 'energia' && activeNorm.includes('energia')) return true;
      if (target === 'camaras' && (activeNorm.includes('camara') || activeNorm.includes('cctv'))) return true;
      if (target === 'acceso' && (activeNorm.includes('acceso') && !activeNorm.includes('accesorio'))) return true;
      if (target === 'redes' && activeNorm.includes('red')) return true;
      if (target === 'cables' && (activeNorm.includes('cable') || activeNorm.includes('accesorio'))) return true;
      return false;
    });
  },

  resetDefaults() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(DEFAULT_FEATURE_FLAGS));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wes_flags_changed', { detail: DEFAULT_FEATURE_FLAGS }));
    }
    return DEFAULT_FEATURE_FLAGS;
  }
};

window.FeatureFlags = FeatureFlags;

// Escuchar cambios entre pestañas (StorageEvent)
window.addEventListener('storage', (e) => {
  if (e.key === FeatureFlags.STORAGE_KEY) {
    try {
      const updated = JSON.parse(e.newValue || '{}');
      window.dispatchEvent(new CustomEvent('wes_flags_changed', { detail: updated }));
    } catch (err) {
      // ignore
    }
  }
});
