import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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

  const employee = await prisma.employee.upsert({
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

  console.log(`Employee created: ${employee.email} (${employee.id})`);

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
