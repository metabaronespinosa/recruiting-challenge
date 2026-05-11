import { db, initSchema } from '../db.js';
import { randomUUID } from 'node:crypto';

const MERCHANTS = [
  { id: 'm_acme', name: 'Acme Supplies' },
  { id: 'm_bistro', name: 'Bistro Verde' },
];

const CUSTOMERS = [
  'ana@example.com',
  'bruno@example.com',
  'carla@example.com',
  'diego@example.com',
  'elena@example.com',
  'felipe@example.com',
];

function randomDateInLast90Days(): string {
  const now = Date.now();
  const offsetMs = Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs).toISOString();
}

export function seedIfEmpty(): void {
  initSchema();
  const existing = db.prepare(`SELECT COUNT(*) AS n FROM orders`).get() as { n: number };
  if (existing.n > 0) return;

  const insertMerchant = db.prepare(
    `INSERT OR IGNORE INTO merchants (id, name) VALUES (?, ?)`,
  );
  for (const m of MERCHANTS) insertMerchant.run(m.id, m.name);

  const insertOrder = db.prepare(
    `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction(() => {
    for (let i = 0; i < 80; i++) {
      const merchant = MERCHANTS[i % MERCHANTS.length]!;
      const customer = CUSTOMERS[i % CUSTOMERS.length]!;
      const amount = Math.floor(2000 + Math.random() * 18000);
      const type: 'sale' | 'refund' = Math.random() < 0.15 ? 'refund' : 'sale';
      insertOrder.run(
        randomUUID(),
        merchant.id,
        customer,
        amount,
        type,
        'completed',
        randomDateInLast90Days(),
      );
    }
  });
  insertMany();
  console.log(`[seed] inserted ${MERCHANTS.length} merchants and 80 orders`);
}

const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1] ?? '');
if (isMain) {
  seedIfEmpty();
}
