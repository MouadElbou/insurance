import { Decimal } from "@prisma/client/runtime/library";

export interface IngestionAdapter {
  name: string;
  parse(input: unknown): Promise<ParsedOperation[]>;
}

export interface ParsedOperation {
  type: "PRODUCTION" | "EMISSION";
  source: "EXCEL" | "MANUAL" | "SCRAPER";
  operator_code: string;
  client_id?: string;
  client_name?: string;
  policy_number: string;
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
