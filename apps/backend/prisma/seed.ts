import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { DEFAULT_INSURER_SEEDS } from "@insurance/shared";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin1234", 12);

  const manager = await prisma.employee.upsert({
    where: { email: "manager@insurance.ma" },
    update: {},
    create: {
      email: "manager@insurance.ma",
      password_hash: passwordHash,
      full_name: "Admin Manager",
      operator_code: "mgr001",
      role: "MANAGER",
      is_active: true,
    },
  });
  console.log(`Manager created: ${manager.email} (${manager.id})`);

  const employeeHash = await bcrypt.hash("employee1234", 12);

  const emp1 = await prisma.employee.upsert({
    where: { email: "employe1@insurance.ma" },
    update: {},
    create: {
      email: "employe1@insurance.ma",
      password_hash: employeeHash,
      full_name: "Ahmed Benali",
      operator_code: "int46442",
      role: "EMPLOYEE",
      is_active: true,
    },
  });
  console.log(`Employee created: ${emp1.email} (${emp1.id})`);

  const emp2 = await prisma.employee.upsert({
    where: { email: "employe2@insurance.ma" },
    update: {},
    create: {
      email: "employe2@insurance.ma",
      password_hash: employeeHash,
      full_name: "Fatima Zahra El Amrani",
      operator_code: "int52718",
      role: "EMPLOYEE",
      is_active: true,
    },
  });
  console.log(`Employee created: ${emp2.email} (${emp2.id})`);

  const emp3 = await prisma.employee.upsert({
    where: { email: "employe3@insurance.ma" },
    update: {},
    create: {
      email: "employe3@insurance.ma",
      password_hash: employeeHash,
      full_name: "Youssef Tazi",
      operator_code: "int63901",
      role: "EMPLOYEE",
      is_active: true,
    },
  });
  console.log(`Employee created: ${emp3.email} (${emp3.id})`);

  const emp4 = await prisma.employee.upsert({
    where: { email: "employe4@insurance.ma" },
    update: {},
    create: {
      email: "employe4@insurance.ma",
      password_hash: employeeHash,
      full_name: "Karim Idrissi",
      operator_code: "int71385",
      role: "EMPLOYEE",
      is_active: false,
    },
  });
  console.log(`Employee created (inactive): ${emp4.email} (${emp4.id})`);

  // Create uploads
  const upload1 = await prisma.upload.create({
    data: {
      filename: "production_mars_2026.xlsx",
      file_size: 245_760,
      status: "COMPLETED",
      total_rows: 25,
      created_count: 23,
      updated_count: 2,
      skipped_count: 0,
      uploaded_by_id: manager.id,
      completed_at: new Date("2026-03-15T10:30:00Z"),
      created_at: new Date("2026-03-15T10:28:00Z"),
    },
  });

  const upload2 = await prisma.upload.create({
    data: {
      filename: "emission_mars_2026.xlsx",
      file_size: 189_440,
      status: "COMPLETED",
      total_rows: 18,
      created_count: 18,
      updated_count: 0,
      skipped_count: 0,
      uploaded_by_id: manager.id,
      completed_at: new Date("2026-03-20T14:15:00Z"),
      created_at: new Date("2026-03-20T14:12:00Z"),
    },
  });

  const upload3 = await prisma.upload.create({
    data: {
      filename: "production_avril_2026.xlsx",
      file_size: 312_832,
      status: "COMPLETED",
      total_rows: 30,
      created_count: 28,
      updated_count: 2,
      skipped_count: 0,
      uploaded_by_id: manager.id,
      completed_at: new Date("2026-04-10T09:45:00Z"),
      created_at: new Date("2026-04-10T09:42:00Z"),
    },
  });

  await prisma.upload.create({
    data: {
      filename: "emission_avril_partiel.xlsx",
      file_size: 98_304,
      status: "FAILED",
      total_rows: 12,
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_message: "Format de colonne invalide en ligne 5",
      uploaded_by_id: emp1.id,
      created_at: new Date("2026-04-12T16:00:00Z"),
    },
  });

  console.log("Uploads created");

  // Insurance clients
  const clients = [
    { id: "CLI-001", name: "Saham Assurance" },
    { id: "CLI-002", name: "Wafa Assurance" },
    { id: "CLI-003", name: "RMA Assurance" },
    { id: "CLI-004", name: "Atlanta Assurance" },
    { id: "CLI-005", name: "AXA Assurance Maroc" },
    { id: "CLI-006", name: "MAMDA" },
    { id: "CLI-007", name: "MCMA" },
    { id: "CLI-008", name: "Zurich Assurance Maroc" },
  ];

  const employees = [emp1, emp2, emp3];
  const policyTypes = ["Auto", "MRH", "Sante", "RC Pro", "Transport", "Vie"];
  const eventTypes = ["Nouvelle affaire", "Renouvellement", "Avenant", "Resiliation"];
  const policyStatuses = ["Active", "En attente", "Expiree", "Resiliee"];

  // Generate PRODUCTION operations
  const productionOps = [];
  for (let i = 0; i < 45; i++) {
    const emp = employees[i % employees.length];
    const client = clients[i % clients.length];
    const policyType = policyTypes[i % policyTypes.length];
    const eventType = eventTypes[i % eventTypes.length];
    const month = i < 20 ? 3 : 4; // March or April
    const day = (i % 28) + 1;
    const primeNet = 2000 + Math.round(Math.random() * 18000);
    const taxRate = 0.14;
    const taxAmount = Math.round(primeNet * taxRate);
    const parafiscal = Math.round(primeNet * 0.035);
    const totalPrime = primeNet + taxAmount + parafiscal;
    const commissionRate = 0.08 + Math.random() * 0.12;
    const commission = Math.round(primeNet * commissionRate);

    productionOps.push({
      type: "PRODUCTION" as const,
      source: i < 25 ? ("EXCEL" as const) : i < 40 ? ("MANUAL" as const) : ("SCRAPER" as const),
      client_id: client.id,
      client_name: client.name,
      policy_number: `POL-${2026}${String(month).padStart(2, "0")}-${String(i + 1).padStart(4, "0")}`,
      avenant_number: eventType === "Avenant" ? `AV-${i + 1}` : null,
      quittance_number: `QUI-${String(i + 1).padStart(5, "0")}`,
      attestation_number: policyType === "Auto" ? `ATT-${String(i + 1).padStart(5, "0")}` : null,
      policy_status: policyStatuses[i % policyStatuses.length],
      event_type: `${eventType} - ${policyType}`,
      emission_date: new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T10:00:00Z`),
      effective_date: new Date(`2026-${String(month).padStart(2, "0")}-${String(Math.min(day + 5, 28)).padStart(2, "0")}T00:00:00Z`),
      prime_net: primeNet,
      tax_amount: taxAmount,
      parafiscal_tax: parafiscal,
      total_prime: totalPrime,
      commission: commission,
      employee_id: emp.id,
      upload_id: i < 23 ? upload1.id : i < 25 ? null : upload3.id,
      created_at: new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(8 + (i % 10)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`),
    });
  }

  // Generate EMISSION operations
  const emissionOps = [];
  for (let i = 0; i < 30; i++) {
    const emp = employees[i % employees.length];
    const client = clients[(i + 3) % clients.length];
    const policyType = policyTypes[(i + 2) % policyTypes.length];
    const month = i < 12 ? 3 : 4;
    const day = (i % 28) + 1;
    const primeNet = 1500 + Math.round(Math.random() * 15000);
    const taxAmount = Math.round(primeNet * 0.14);
    const parafiscal = Math.round(primeNet * 0.035);
    const totalPrime = primeNet + taxAmount + parafiscal;
    const commission = Math.round(primeNet * (0.08 + Math.random() * 0.12));

    emissionOps.push({
      type: "EMISSION" as const,
      source: i < 18 ? ("EXCEL" as const) : ("MANUAL" as const),
      client_id: client.id,
      client_name: client.name,
      policy_number: `POL-EM-${2026}${String(month).padStart(2, "0")}-${String(i + 1).padStart(4, "0")}`,
      avenant_number: null,
      quittance_number: `QEM-${String(i + 1).padStart(5, "0")}`,
      attestation_number: null,
      policy_status: "Active",
      event_type: `Emission - ${policyType}`,
      emission_date: new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T10:00:00Z`),
      effective_date: new Date(`2026-${String(month).padStart(2, "0")}-${String(Math.min(day + 3, 28)).padStart(2, "0")}T00:00:00Z`),
      prime_net: primeNet,
      tax_amount: taxAmount,
      parafiscal_tax: parafiscal,
      total_prime: totalPrime,
      commission: commission,
      employee_id: emp.id,
      upload_id: i < 18 ? upload2.id : null,
      created_at: new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(9 + (i % 8)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`),
    });
  }

  for (const op of [...productionOps, ...emissionOps]) {
    await prisma.operation.create({ data: op });
  }

  console.log(`Created ${productionOps.length} production operations`);
  console.log(`Created ${emissionOps.length} emission operations`);

  // Scraper: insurer domain allowlist (idempotent).
  //
  // We seed FROM the shared constant DEFAULT_INSURER_SEEDS rather than inlining
  // host_pattern strings here. Seed rows are REGEX source and host-matching
  // happens via `new RegExp(host_pattern, "i")` in loadEnabledDomains — an
  // unanchored literal like "portail.rmaassurance.com" matches
  // "attacker-portail.rmaassurance.comx" because `.` is regex-any-byte.
  //
  // Using the shared constant guarantees:
  //   1. Patterns are properly anchored (^...$) and escaped (\\.),
  //   2. Electron main, backend seed, and any future bootstrapper agree on
  //      which insurers are enabled out of the box, and
  //   3. Fix for feedback-iteration-1 B2.
  for (const seed of DEFAULT_INSURER_SEEDS) {
    const row = await prisma.insurerDomain.upsert({
      where: { host_pattern: seed.host_pattern },
      update: {},
      create: {
        insurer_code: seed.insurer_code,
        host_pattern: seed.host_pattern,
        label: seed.label,
        capture_enabled: true,
        created_by_id: manager.id,
      },
    });
    console.log(`Insurer domain upserted: ${row.host_pattern}`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
