/**
 * RMA transformer — extrait les informations client et opération à partir
 * du trafic HTTP capturé sur `rmaassurance.com` et ses sous-domaines.
 *
 * Architecture:
 *   - Un dispatcher pur qui apparie chaque événement à un gestionnaire
 *     d'endpoint par `pathname` + `method`.
 *   - Chaque gestionnaire lit les bodies JSON déjà capturés et projette
 *     les champs connus (client_id, client_name, policy_number, primes…)
 *     vers un `ParsedOperation`.
 *   - Aucun gestionnaire trouvé → verdict IGNORED avec notes diagnostiques
 *     décrivant le chemin, la méthode et les clés JSON observées.
 *     Les notes sont ensuite exposées dans le dashboard (ScraperEvent.
 *     transformer_notes) afin qu'une vraie session de capture révèle
 *     directement la carte des endpoints RMA.
 *
 * Contrat (respecté):
 *   - Pur : aucune IO, aucune écriture DB, aucun émetteur Socket.IO.
 *   - Les erreurs sur un événement deviennent un verdict ERROR — jamais
 *     une exception remontée au caller.
 */
import { Decimal } from "@prisma/client/runtime/library";
import type { ParsedOperation } from "../adapter.interface.js";
import type {
  Transformer,
  TransformerContext,
  TransformerInputEvent,
  TransformerResult,
  TransformerVerdictAnnotation,
} from "./transformer.interface.js";

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires purs
// ─────────────────────────────────────────────────────────────────────────────

function safeParseJson(raw: string | null | undefined): unknown {
  if (!raw || raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function pickString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) return trimmed;
    }
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickDate(
  obj: Record<string, unknown>,
  keys: readonly string[],
): Date | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return undefined;
}

function pickDecimal(
  obj: Record<string, unknown>,
  keys: readonly string[],
): Decimal | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return new Decimal(v);
    if (typeof v === "string" && v.trim().length > 0) {
      // RMA envoie parfois des montants au format "12 345,67" (fr-FR).
      const normalized = v.trim().replace(/\s/g, "").replace(",", ".");
      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        try {
          return new Decimal(normalized);
        } catch {
          /* tombera sur undefined */
        }
      }
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clés candidates — noms de champs fréquemment utilisés par RMA ou les
// plateformes d'assurance marocaines/françaises. Ajuster au besoin une fois
// les payloads réels observés.
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_ID_KEYS = [
  "client_id",
  "clientId",
  "idClient",
  "id_client",
  "numeroClient",
  "numero_client",
  "clientNumber",
  "codeClient",
  "code_client",
  "referenceClient",
  "reference_client",
] as const;

const CLIENT_NAME_COMPOSITE_KEYS = [
  "client_name",
  "clientName",
  "nomComplet",
  "nom_complet",
  "raisonSociale",
  "raison_sociale",
  "denomination",
  "fullName",
  "full_name",
  "nomSouscripteur",
  "nom_souscripteur",
  "nomAssure",
  "nom_assure",
  "label",
] as const;

const CLIENT_FIRST_NAME_KEYS = ["prenom", "firstName", "first_name", "givenName"] as const;
const CLIENT_LAST_NAME_KEYS = ["nom", "lastName", "last_name", "familyName", "surname"] as const;

const POLICY_NUMBER_KEYS = [
  "numeroPolice",
  "numero_police",
  "policyNumber",
  "policy_number",
  "numeroContrat",
  "numero_contrat",
  "contractNumber",
  "contract_number",
  "numPolice",
  "num_police",
] as const;
const AVENANT_NUMBER_KEYS = [
  "numeroAvenant",
  "numero_avenant",
  "avenant",
  "avenantNumber",
  "numAvenant",
] as const;
const QUITTANCE_NUMBER_KEYS = [
  "numeroQuittance",
  "numero_quittance",
  "quittance",
  "quittanceNumber",
  "numeroRecu",
  "numero_recu",
] as const;
const ATTESTATION_KEYS = [
  "numeroAttestation",
  "numero_attestation",
  "attestation",
  "attestationNumber",
] as const;
const POLICY_STATUS_KEYS = ["statut", "status", "etat", "state"] as const;
const EVENT_TYPE_KEYS = [
  "typeEvenement",
  "type_evenement",
  "eventType",
  "event_type",
  "nature",
  "typeOperation",
  "type_operation",
] as const;
const EMISSION_DATE_KEYS = [
  "dateEmission",
  "date_emission",
  "emissionDate",
  "emission_date",
  "dateCreation",
  "date_creation",
] as const;
const EFFECTIVE_DATE_KEYS = [
  "dateEffet",
  "date_effet",
  "effectiveDate",
  "effective_date",
  "dateDebut",
  "date_debut",
] as const;
const PRIME_NET_KEYS = ["primeNet", "prime_net", "primeNette", "prime_nette"] as const;
const TAX_AMOUNT_KEYS = [
  "taxes",
  "tax_amount",
  "taxAmount",
  "montantTaxes",
  "montant_taxes",
] as const;
const PARAFISCAL_TAX_KEYS = [
  "taxeParafiscale",
  "taxe_parafiscale",
  "parafiscalTax",
  "parafiscal_tax",
] as const;
const TOTAL_PRIME_KEYS = [
  "primeTotale",
  "prime_totale",
  "primeTotal",
  "prime_total",
  "totalPrime",
  "total_prime",
  "montantTotal",
  "montant_total",
] as const;
const COMMISSION_KEYS = [
  "commission",
  "commissionAmount",
  "montantCommission",
  "montant_commission",
] as const;

/**
 * Conteneurs fréquents dans lesquels RMA imbrique les objets utiles
 * (`{ data: { client: {...} } }`, `{ result: {...} }`, etc.).
 */
const WRAPPER_KEYS = [
  "data",
  "result",
  "payload",
  "body",
  "content",
  "item",
  "items",
  "client",
  "customer",
  "souscripteur",
  "assure",
  "police",
  "contrat",
  "quittance",
  "operation",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Extraction
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedClient {
  client_id?: string;
  client_name?: string;
}

interface ExtractedPolicy {
  policy_number?: string;
  avenant_number?: string;
  quittance_number?: string;
  attestation_number?: string;
  policy_status?: string;
  event_type?: string;
  emission_date?: Date;
  effective_date?: Date;
  prime_net?: Decimal;
  tax_amount?: Decimal;
  parafiscal_tax?: Decimal;
  total_prime?: Decimal;
  commission?: Decimal;
}

/**
 * Recherche en profondeur limitée (3 niveaux) des attributs client dans
 * l'arbre JSON. On ne descend que dans les conteneurs connus pour éviter
 * un scan coûteux sur de gros payloads.
 */
function extractClient(root: unknown, depth = 0): ExtractedClient {
  if (depth > 3) return {};
  const rec = asRecord(root);
  if (!rec) return {};

  const here: ExtractedClient = {
    client_id: pickString(rec, CLIENT_ID_KEYS),
    client_name: pickString(rec, CLIENT_NAME_COMPOSITE_KEYS),
  };
  if (!here.client_name) {
    const first = pickString(rec, CLIENT_FIRST_NAME_KEYS);
    const last = pickString(rec, CLIENT_LAST_NAME_KEYS);
    if (first && last) here.client_name = `${first} ${last}`;
    else here.client_name = last ?? first;
  }

  if (here.client_id && here.client_name) return here;

  for (const key of WRAPPER_KEYS) {
    const child = rec[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = extractClient(item, depth + 1);
        here.client_id = here.client_id ?? found.client_id;
        here.client_name = here.client_name ?? found.client_name;
        if (here.client_id && here.client_name) return here;
      }
    } else if (child !== undefined) {
      const found = extractClient(child, depth + 1);
      here.client_id = here.client_id ?? found.client_id;
      here.client_name = here.client_name ?? found.client_name;
      if (here.client_id && here.client_name) return here;
    }
  }
  return here;
}

function extractPolicy(root: unknown, depth = 0): ExtractedPolicy {
  if (depth > 3) return {};
  const rec = asRecord(root);
  if (!rec) return {};

  const here: ExtractedPolicy = {
    policy_number: pickString(rec, POLICY_NUMBER_KEYS),
    avenant_number: pickString(rec, AVENANT_NUMBER_KEYS),
    quittance_number: pickString(rec, QUITTANCE_NUMBER_KEYS),
    attestation_number: pickString(rec, ATTESTATION_KEYS),
    policy_status: pickString(rec, POLICY_STATUS_KEYS),
    event_type: pickString(rec, EVENT_TYPE_KEYS),
    emission_date: pickDate(rec, EMISSION_DATE_KEYS),
    effective_date: pickDate(rec, EFFECTIVE_DATE_KEYS),
    prime_net: pickDecimal(rec, PRIME_NET_KEYS),
    tax_amount: pickDecimal(rec, TAX_AMOUNT_KEYS),
    parafiscal_tax: pickDecimal(rec, PARAFISCAL_TAX_KEYS),
    total_prime: pickDecimal(rec, TOTAL_PRIME_KEYS),
    commission: pickDecimal(rec, COMMISSION_KEYS),
  };

  if (here.policy_number) return here;

  for (const key of WRAPPER_KEYS) {
    const child = rec[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = extractPolicy(item, depth + 1);
        mergePolicy(here, found);
        if (here.policy_number) return here;
      }
    } else if (child !== undefined) {
      const found = extractPolicy(child, depth + 1);
      mergePolicy(here, found);
      if (here.policy_number) return here;
    }
  }
  return here;
}

function mergePolicy(into: ExtractedPolicy, from: ExtractedPolicy): void {
  into.policy_number = into.policy_number ?? from.policy_number;
  into.avenant_number = into.avenant_number ?? from.avenant_number;
  into.quittance_number = into.quittance_number ?? from.quittance_number;
  into.attestation_number = into.attestation_number ?? from.attestation_number;
  into.policy_status = into.policy_status ?? from.policy_status;
  into.event_type = into.event_type ?? from.event_type;
  into.emission_date = into.emission_date ?? from.emission_date;
  into.effective_date = into.effective_date ?? from.effective_date;
  into.prime_net = into.prime_net ?? from.prime_net;
  into.tax_amount = into.tax_amount ?? from.tax_amount;
  into.parafiscal_tax = into.parafiscal_tax ?? from.parafiscal_tax;
  into.total_prime = into.total_prime ?? from.total_prime;
  into.commission = into.commission ?? from.commission;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch par endpoint
// ─────────────────────────────────────────────────────────────────────────────

interface HandlerOutcome {
  operations: ParsedOperation[];
  verdict: TransformerVerdictAnnotation;
}

interface EndpointHandler {
  readonly description: string;
  matches(pathname: string, method: string): boolean;
  handle(event: TransformerInputEvent, ctx: TransformerContext): HandlerOutcome;
}

/**
 * Infère le type d'opération (PRODUCTION vs EMISSION) à partir du pathname.
 *   - "production" ou "quittance" → PRODUCTION (encaissement)
 *   - "emission", "souscription" ou "nouvelle affaire" → EMISSION
 *   - défaut : EMISSION (opération émise mais pas encore encaissée)
 */
function inferOperationType(pathname: string): "PRODUCTION" | "EMISSION" {
  const p = pathname.toLowerCase();
  if (p.includes("quittance") || p.includes("production") || p.includes("recu")) {
    return "PRODUCTION";
  }
  return "EMISSION";
}

function buildOperation(
  type: "PRODUCTION" | "EMISSION",
  ctx: TransformerContext,
  client: ExtractedClient,
  policy: ExtractedPolicy,
): ParsedOperation {
  return {
    type,
    source: "SCRAPER",
    operator_code: ctx.operatorCode,
    client_id: client.client_id,
    client_name: client.client_name,
    policy_number: policy.policy_number!, // vérifié par le caller
    avenant_number: policy.avenant_number,
    quittance_number: policy.quittance_number,
    attestation_number: policy.attestation_number,
    policy_status: policy.policy_status,
    event_type: policy.event_type,
    emission_date: policy.emission_date,
    effective_date: policy.effective_date,
    prime_net: policy.prime_net,
    tax_amount: policy.tax_amount,
    parafiscal_tax: policy.parafiscal_tax,
    total_prime: policy.total_prime,
    commission: policy.commission,
  };
}

function topLevelKeys(obj: unknown): string[] {
  const rec = asRecord(obj);
  if (!rec) return [];
  return Object.keys(rec).slice(0, 12);
}

function ignored(
  event: TransformerInputEvent,
  notes: string,
): HandlerOutcome {
  return {
    operations: [],
    verdict: { event_id: event.id, verdict: "IGNORED", notes },
  };
}

function errored(
  event: TransformerInputEvent,
  notes: string,
): HandlerOutcome {
  return {
    operations: [],
    verdict: { event_id: event.id, verdict: "ERROR", notes },
  };
}

/**
 * Gestionnaire endpoints client pur (création / mise à jour d'un client
 * sans police). On extrait l'identifiant et le nom, mais on n'émet pas
 * d'opération — `Operation` exige `policy_number`. L'info est remontée
 * dans les notes pour audit + corrélation future avec les évènements police.
 */
const clientEndpointHandler: EndpointHandler = {
  description: "Création / mise à jour de client (sans police)",
  matches(pathname, method) {
    const p = pathname.toLowerCase();
    const m = method.toUpperCase();
    if (!(m === "POST" || m === "PUT" || m === "PATCH")) return false;
    // On vise les paths "client" isolés — pas "souscription" ni "quittance".
    if (p.includes("quittance") || p.includes("police") || p.includes("contrat")) {
      return false;
    }
    return /\/clients?(\/|$|\?)/.test(p) || /\/customers?(\/|$|\?)/.test(p);
  },
  handle(event) {
    const body = safeParseJson(event.response_body) ?? safeParseJson(event.request_body);
    if (body === undefined) {
      return ignored(
        event,
        `Endpoint client (${event.method} ${event.pathname}) — body non-JSON ou vide, aucune extraction possible.`,
      );
    }
    const client = extractClient(body);
    if (!client.client_id && !client.client_name) {
      return ignored(
        event,
        `Endpoint client détecté (${event.method} ${event.pathname}) — aucun champ identifiable. Clés observées: [${topLevelKeys(body).join(", ")}].`,
      );
    }
    // Pas d'opération émise : pas de policy_number. On loggue l'info client.
    const fragments: string[] = [];
    if (client.client_id) fragments.push(`id=${client.client_id}`);
    if (client.client_name) fragments.push(`nom="${client.client_name}"`);
    return ignored(
      event,
      `Client capturé (${event.method} ${event.pathname}) — ${fragments.join(", ")}. En attente d'une police pour produire une opération.`,
    );
  },
};

/**
 * Gestionnaire police / contrat / souscription / quittance. On tente
 * d'extraire à la fois les champs police ET les champs client depuis le
 * même payload (RMA renvoie généralement tout dans la réponse de création).
 */
const policyEndpointHandler: EndpointHandler = {
  description: "Émission de police / avenant / quittance",
  matches(pathname, method) {
    const p = pathname.toLowerCase();
    const m = method.toUpperCase();
    if (!(m === "POST" || m === "PUT")) return false;
    return (
      /\/polices?(\/|$|\?)/.test(p) ||
      /\/contrats?(\/|$|\?)/.test(p) ||
      /\/souscriptions?(\/|$|\?)/.test(p) ||
      /\/quittances?(\/|$|\?)/.test(p) ||
      /\/productions?(\/|$|\?)/.test(p) ||
      /\/emissions?(\/|$|\?)/.test(p)
    );
  },
  handle(event, ctx) {
    const body = safeParseJson(event.response_body);
    if (body === undefined) {
      // Body absent/non-JSON : c'est une anomalie pour un endpoint métier,
      // mais on reste souple — l'utilisateur a peut-être annulé.
      return ignored(
        event,
        `Endpoint police (${event.method} ${event.pathname}) — réponse non-JSON (status ${event.status_code ?? "?"}), rien à extraire.`,
      );
    }
    const policy = extractPolicy(body);
    const client = extractClient(body);

    if (!policy.policy_number) {
      return ignored(
        event,
        `Endpoint police (${event.method} ${event.pathname}) — numéro de police introuvable. Clés observées: [${topLevelKeys(body).join(", ")}]. Étendre POLICY_NUMBER_KEYS si le champ réel diffère.`,
      );
    }

    const type = inferOperationType(event.pathname);
    const operation = buildOperation(type, ctx, client, policy);
    const clientFragment = client.client_id || client.client_name
      ? `client=${client.client_id ?? "?"}/${client.client_name ?? "?"}`
      : "client=(absent du payload)";

    return {
      operations: [operation],
      verdict: {
        event_id: event.id,
        verdict: "TRANSFORMED",
        notes: `${type} ${policy.policy_number} capturée — ${clientFragment}.`,
        operation_keys: [
          {
            type,
            policy_number: policy.policy_number,
            avenant_number: policy.avenant_number,
            quittance_number: policy.quittance_number,
          },
        ],
      },
    };
  },
};

const ENDPOINT_HANDLERS: readonly EndpointHandler[] = [
  clientEndpointHandler,
  policyEndpointHandler,
];

// ─────────────────────────────────────────────────────────────────────────────
// Transformer
// ─────────────────────────────────────────────────────────────────────────────

export class RmaTransformer implements Transformer {
  readonly insurer_code = "RMA";

  /**
   * Matches `rmaassurance.com` et tous ses sous-domaines (portail., www., gama., …).
   * Ancré pour éviter les homographes.
   */
  readonly hostPattern = /(^|\.)rmaassurance\.com$/i;

  async transform(
    events: TransformerInputEvent[],
    context: TransformerContext,
  ): Promise<TransformerResult> {
    const operations: ParsedOperation[] = [];
    const verdicts: TransformerVerdictAnnotation[] = [];

    for (const event of events) {
      let outcome: HandlerOutcome;
      try {
        outcome = this.transformOne(event, context);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outcome = errored(
          event,
          `Exception interne pendant la transformation: ${message}`,
        );
      }
      operations.push(...outcome.operations);
      verdicts.push(outcome.verdict);
    }

    return { operations, verdicts };
  }

  private transformOne(
    event: TransformerInputEvent,
    ctx: TransformerContext,
  ): HandlerOutcome {
    // Ignorer les lectures GET : la capture s'intéresse aux mutations
    // (création, édition) — c'est là qu'arrive l'info client saisie.
    const method = event.method.toUpperCase();
    if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
      return ignored(
        event,
        `Méthode ${method} ignorée — seules les mutations (POST/PUT/PATCH) portent les saisies client.`,
      );
    }

    // Les échecs serveur ne portent pas d'info utile.
    if (event.status_code !== null && event.status_code >= 400) {
      return ignored(
        event,
        `Statut ${event.status_code} — opération probablement rejetée par le portail.`,
      );
    }

    for (const handler of ENDPOINT_HANDLERS) {
      if (handler.matches(event.pathname, method)) {
        return handler.handle(event, ctx);
      }
    }

    // Fallback diagnostique : aucune règle ne matche. On expose le maximum
    // d'infos dans les notes pour que la première session de capture réelle
    // révèle la forme des endpoints RMA.
    const body = safeParseJson(event.response_body);
    const keys = topLevelKeys(body);
    const hint = keys.length > 0
      ? ` Clés de la réponse: [${keys.join(", ")}].`
      : " Réponse non-JSON ou vide.";
    return ignored(
      event,
      `Endpoint RMA inconnu: ${method} ${event.pathname}.${hint} Ajouter un gestionnaire dans rma.transformer.ts si cet endpoint porte des données métier.`,
    );
  }
}
