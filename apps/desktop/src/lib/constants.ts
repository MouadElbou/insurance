export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const ITEMS_PER_PAGE = 25;
export const HEARTBEAT_INTERVAL = 30000;

export const PRESENCE_COLORS = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-400",
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
