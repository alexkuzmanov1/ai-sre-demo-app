import 'dotenv/config';
import mongoose from 'mongoose';
import { User, UserSchema } from '../src/users/user.schema';
import { Product, ProductSchema } from '../src/products/product.schema';

const BASE_URL = `http://localhost:${process.env.PORT ?? '3000'}`;
const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/shop';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function hit(
  method: string,
  path: string,
  body?: unknown,
): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    console.log(`${method} ${path} -> ${res.status}`);
  } catch (err) {
    // Never exit on errors — the app may be mid-reload from a break/fix merge.
    console.log(
      `${method} ${path} -> ERROR ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function loadIds(): Promise<{ userIds: string[]; productIds: string[] }> {
  await mongoose.connect(MONGODB_URI);
  const UserModel =
    mongoose.models[User.name] ?? mongoose.model(User.name, UserSchema);
  const ProductModel =
    mongoose.models[Product.name] ??
    mongoose.model(Product.name, ProductSchema);
  const users = await UserModel.find().select('_id').lean();
  const products = await ProductModel.find().select('_id').lean();
  await mongoose.disconnect();
  return {
    userIds: users.map((u) => String(u._id)),
    productIds: products.map((p) => String(p._id)),
  };
}

async function main(): Promise<void> {
  let ids = await loadIds();
  while (ids.userIds.length === 0 || ids.productIds.length === 0) {
    console.log('[traffic] no seeded data found — retrying in 3s (run `pnpm seed`)');
    await sleep(3000);
    ids = await loadIds();
  }
  console.log(
    `[traffic] driving ${BASE_URL} with ${ids.userIds.length} users / ${ids.productIds.length} products`,
  );

  let tick = 0;
  // Loop forever. Every 3s: GET summary / orders / products.
  // Every 3rd tick (~9-10s): POST /orders with a random valid user/product.
  for (;;) {
    tick += 1;
    await hit('GET', `/users/${pick(ids.userIds)}/summary`);
    await hit('GET', '/orders');
    await hit('GET', '/products');
    if (tick % 3 === 0) {
      await hit('POST', '/orders', {
        userId: pick(ids.userIds),
        productId: pick(ids.productIds),
        qty: Math.floor(Math.random() * 3) + 1,
      });
    }
    await sleep(3000);
  }
}

main().catch((err) => {
  console.error('[traffic] fatal:', err);
  process.exit(1);
});
