export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const ITEMS_PER_PAGE = 25;
export const HEARTBEAT_INTERVAL = 30000;

export const PRESENCE_COLORS = {
  online: "bg-presence-online",
  idle: "bg-presence-idle",
  offline: "bg-presence-offline",
} as const;

export const PRESENCE_LABELS: Record<string, string> = {
  online: "En ligne",
  idle: "Inactif",
  offline: "Hors ligne",
};

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  PRODUCTION: "Production",
  EMISSION: "Emission",
};

export const OPERATION_SOURCE_LABELS: Record<string, string> = {
  EXCEL: "Excel",
  MANUAL: "Saisie manuelle",
  SCRAPER: "Scraper",
};

export const UPLOAD_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  COMPLETED: "Termine",
  FAILED: "Echoue",
};

export const CAPTURE_STATUS_LABELS: Record<string, string> = {
  IDLE: "Inactif",
  OPENING: "Ouverture...",
  OPEN: "Portail ouvert",
  CAPTURING: "Capture en cours",
  CLOSED: "Fermé",
  ERROR: "Erreur",
};

export const CAPTURE_STATUS_COLORS: Record<string, string> = {
  IDLE: "bg-outline-variant/40 text-on-surface-variant",
  OPENING: "bg-tertiary-container text-on-tertiary-container",
  OPEN: "bg-secondary-container text-on-secondary-container",
  CAPTURING: "bg-primary-fixed text-on-primary-fixed",
  CLOSED: "bg-outline-variant/40 text-on-surface-variant",
  ERROR: "bg-error-container text-on-error-container",
};

export const TRANSFORMER_VERDICT_LABELS: Record<string, string> = {
  PENDING: "En attente",
  TRANSFORMED: "Transformé",
  IGNORED: "Ignoré",
  ERROR: "Erreur",
};

export const TRANSFORMER_VERDICT_COLORS: Record<string, string> = {
  PENDING: "bg-tertiary-container text-on-tertiary-container",
  TRANSFORMED: "bg-secondary-container text-on-secondary-container",
  IGNORED: "bg-outline-variant/40 text-on-surface-variant",
  ERROR: "bg-error-container text-on-error-container",
};
