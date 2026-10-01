/**
 * Seed inicial e modo demo do FPOne Intranet.
 * Garante a criação do Usuário Master Administrador para gerenciamento interno.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;

async function main() {
  if (!url) {
    console.log("==> [Seed] DATABASE_URL não definida, ignorando seed.");
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    const masterUsername = (process.env.MASTER_ADMIN_USERNAME || "admin").trim().toLowerCase();
    const masterEmail = process.env.MASTER_ADMIN_EMAIL || "admin@fazendaprogresso.com.br";

    console.log(`==> [Seed] Verificando Usuário Master (${masterUsername})...`);

    let employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { adUsername: masterUsername },
          { matricula: "MASTER-001" },
          { corporateEmail: masterEmail },
        ],
      },
      include: { user: true },
    });

    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          matricula: "MASTER-001",
          adUsername: masterUsername,
          name: "Administrador Master",
          unit: "Sede",
          department: "Tecnologia",
          jobTitle: "Administrador Geral",
          corporateEmail: masterEmail,
          status: "ACTIVE",
          user: {
            create: {
              roles: ["ADMIN"],
              sessionVersion: 1,
            },
          },
        },
        include: { user: true },
      });
      console.log(`==> [Seed] Usuário Master criado com sucesso (ID: ${employee.user?.id}).`);
    } else {
      if (employee.status !== "ACTIVE") {
        await prisma.employee.update({ where: { id: employee.id }, data: { status: "ACTIVE" } });
      }
      if (employee.user && !employee.user.roles.includes("ADMIN")) {
        await prisma.user.update({
          where: { id: employee.user.id },
          data: { roles: { push: "ADMIN" } },
        });
        console.log(`==> [Seed] Perfil ADMIN adicionado ao usuário Master existente.`);
      } else {
        console.log(`==> [Seed] Usuário Master já existe e está ativo com perfil ADMIN.`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("==> [Seed] Erro ao executar seed:", err);
});
