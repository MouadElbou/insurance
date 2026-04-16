export type OperationType = "PRODUCTION" | "EMISSION";
export type OperationSource = "EXCEL" | "MANUAL" | "SCRAPER";

export interface Operation {
  id: string;
  type: OperationType;
  source: OperationSource;
  client_id: string | null;
  client_name: string | null;
  policy_number: string;
  avenant_number: string | null;
  quittance_number: string | null;
  attestation_number: string | null;
  policy_status: string | null;
  event_type: string | null;
  emission_date: string | null;
  effective_date: string | null;
  prime_net: string | null;
  tax_amount: string | null;
  parafiscal_tax: string | null;
  total_prime: string | null;
  commission: string | null;
  employee_id: string;
  employee_name?: string;
  upload_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOperationRequest {
  type: OperationType;
  client_id?: string;
  client_name?: string;
  policy_number: string;
  avenant_number?: string;
  quittance_number?: string;
  attestation_number?: string;
  policy_status?: string;
  event_type?: string;
  emission_date?: string;
  effective_date?: string;
  prime_net?: string;
  tax_amount?: string;
  parafiscal_tax?: string;
  total_prime?: string;
  commission?: string;
}

export interface OperationFilters {
  employee_id?: string;
  type?: OperationType;
  source?: OperationSource;
  policy_status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: "created_at" | "effective_date" | "emission_date" | "prime_net" | "total_prime";
  sort_order?: "asc" | "desc";
}

export interface OperationStats {
  total_operations: number;
  total_prime_net: string;
  total_commissions: string;
  total_policies: number;
  by_type: {
    PRODUCTION: number;
    EMISSION: number;
  };
  by_source: {
    EXCEL: number;
    MANUAL: number;
    SCRAPER: number;
  };
}
