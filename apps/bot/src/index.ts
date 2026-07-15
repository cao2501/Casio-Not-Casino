import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { Kernel } from './core/Kernel';

async function main() {
  const kernel = new Kernel();
  await kernel.boot();
}

main().catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
