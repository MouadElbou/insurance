import { Decimal } from "@prisma/client/runtime/library";
import type { IngestionAdapter, ParsedOperation } from "../adapter.interface.js";
import type { CreateOperationRequest } from "@insurance/shared";

interface ManualAdapterInput {
  data: CreateOperationRequest;
  operator_code: string;
}

export class ManualAdapter implements IngestionAdapter {
  name = "manual";

  async parse(input: unknown): Promise<ParsedOperation[]> {
    const { data, operator_code } = input as ManualAdapterInput;

    const op: ParsedOperation = {
      type: data.type,
      source: "MANUAL",
      operator_code,
      policy_number: data.policy_number,
      client_id: data.client_id,
      client_name: data.client_name,
      avenant_number: data.avenant_number,
      quittance_number: data.quittance_number,
      attestation_number: data.attestation_number,
      policy_status: data.policy_status,
      event_type: data.event_type,
      emission_date: data.emission_date ? new Date(data.emission_date) : undefined,
      effective_date: data.effective_date ? new Date(data.effective_date) : undefined,
      prime_net: data.prime_net ? new Decimal(data.prime_net) : undefined,
      tax_amount: data.tax_amount ? new Decimal(data.tax_amount) : undefined,
      parafiscal_tax: data.parafiscal_tax ? new Decimal(data.parafiscal_tax) : undefined,
      total_prime: data.total_prime ? new Decimal(data.total_prime) : undefined,
      commission: data.commission ? new Decimal(data.commission) : undefined,
    };

    return [op];
  }
}
