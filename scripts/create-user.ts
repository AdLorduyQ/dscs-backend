import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../src/utils/crypto.util';
import { UserRole } from '../src/enums/userRole.enum';

function printUsage(): void {
  console.error(`
Uso:
  npm run create-user -- "<nombre>" "<correo>" "<contraseña_plana>" [rol]

rol (opcional):
  1 = Admin (por defecto)
  2 = Operator

Ejemplo:
  npm run create-user -- "Ana López" "ana@empresa.com" "MiClaveSegura"
  npm run create-user -- "Pedro" "pedro@empresa.com" "OtraClave" 2
`);
}

function parseRol(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return UserRole.Admin;
  }
  const n = Number(raw);
  if (n !== UserRole.Admin && n !== UserRole.Operator) {
    throw new Error(`rol inválido: ${raw}. Usa ${UserRole.Admin} (Admin) o ${UserRole.Operator} (Operator).`);
  }
  return n;
}

async function main(): Promise<void> {
  const [, , nombre, correo, plainPassword, rolArg] = process.argv;
  if (!nombre || !correo || !plainPassword) {
    printUsage();
    process.exit(1);
  }

  const rol = parseRol(rolArg);
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { correo } });
    if (existing) {
      console.error(`Ya existe un usuario con el correo: ${correo}`);
      process.exit(1);
    }

    const contrasena = await CryptoUtil.hashPassword(plainPassword);

    const user = await prisma.user.create({
      data: {
        nombre,
        correo,
        contrasena,
        rol,
      },
    });

    console.log('\nUsuario creado:\n');
    console.log(`  id_usuario: ${user.id_usuario}`);
    console.log(`  nombre:     ${user.nombre}`);
    console.log(`  correo:     ${user.correo}`);
    console.log(`  rol:        ${user.rol} (${user.rol === UserRole.Admin ? 'Admin' : 'Operator'})\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
