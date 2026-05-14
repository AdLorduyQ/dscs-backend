import { CryptoUtil } from '../src/utils/crypto.util';

async function main(): Promise<void> {
  const plain = process.argv[2];
  if (!plain) {
    console.error('Uso: npm run hash-password -- "<contraseña_plana>"');
    process.exit(1);
  }

  const hash = await CryptoUtil.hashPassword(plain);
  console.log('\nCopia este valor en el campo contrasena / contraseña del INSERT o Prisma:\n');
  console.log(hash);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
