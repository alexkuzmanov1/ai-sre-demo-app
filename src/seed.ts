import 'reflect-metadata';
import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { User, UserSchema } from './users/user.schema';
import { Product, ProductSchema } from './products/product.schema';
import { Order, OrderSchema } from './orders/order.schema';

interface SeedOrder {
  orderNumber: string;
  userId: Types.ObjectId;
  total: number;
  status: string;
  createdAt: Date;
}

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/shop';
  await mongoose.connect(uri);
  console.log(`[seed] connected to ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')}`);

  const UserModel = mongoose.model(User.name, UserSchema);
  const ProductModel = mongoose.model(Product.name, ProductSchema);
  const OrderModel = mongoose.model(Order.name, OrderSchema);

  // Drop collections for a clean, repeatable slate.
  await Promise.all([
    UserModel.deleteMany({}),
    ProductModel.deleteMany({}),
    OrderModel.deleteMany({}),
  ]);
  console.log('[seed] cleared users / products / orders');

  // 5 users — at least 2 with preferences = null (new users).
  const users = await UserModel.insertMany([
    {
      email: 'ava@example.com',
      name: 'Ava Stone',
      preferences: { currency: 'USD', locale: 'en-US' },
    },
    {
      email: 'ben@example.com',
      name: 'Ben Carter',
      preferences: { currency: 'GBP', locale: 'en-GB' },
    },
    {
      email: 'cai@example.com',
      name: 'Cai Rivera',
      preferences: { currency: 'EUR', locale: 'es-ES' },
    },
    { email: 'dee@example.com', name: 'Dee Novak', preferences: null },
    { email: 'eli@example.com', name: 'Eli Ford', preferences: null },
  ]);
  console.log(`[seed] inserted ${users.length} users (2 with null preferences)`);

  // ~10 products.
  const products = await ProductModel.insertMany([
    { name: 'Aluminum Water Bottle', priceCents: 1899, stock: 120 },
    { name: 'Bamboo Cutting Board', priceCents: 2499, stock: 60 },
    { name: 'Ceramic Mug', priceCents: 1299, stock: 200 },
    { name: 'Desk Lamp', priceCents: 4599, stock: 45 },
    { name: 'Espresso Cups (set of 4)', priceCents: 3299, stock: 80 },
    { name: 'Fleece Blanket', priceCents: 3999, stock: 75 },
    { name: 'Glass Food Container', priceCents: 2199, stock: 150 },
    { name: 'Hardcover Notebook', priceCents: 1599, stock: 300 },
    { name: 'Insulated Lunch Bag', priceCents: 2799, stock: 90 },
    { name: 'Jar Candle', priceCents: 1999, stock: 110 },
  ]);
  console.log(`[seed] inserted ${products.length} products`);

  // ~15 orders across users, each with a unique orderNumber. Seed order
  // numbers are deterministic (ORD-SEED-NNNN); runtime POST /orders uses
  // generateOrderNumber(). createdAt is staggered so the desc sort is visible.
  const now = Date.now();
  const orderDocs: SeedOrder[] = [];
  for (let i = 0; i < 15; i++) {
    const user = users[i % users.length];
    const product = products[i % products.length];
    const qty = (i % 3) + 1;
    orderDocs.push({
      orderNumber: `ORD-SEED-${String(i + 1).padStart(4, '0')}`,
      userId: user._id as Types.ObjectId,
      total: product.priceCents * qty,
      status: i % 4 === 0 ? 'paid' : 'created',
      createdAt: new Date(now - i * 3_600_000),
    });
  }
  await OrderModel.insertMany(orderDocs);
  console.log(`[seed] inserted ${orderDocs.length} orders`);

  // syncIndexes so the unique index on orderNumber (orderNumber_1) exists.
  await Promise.all([
    UserModel.syncIndexes(),
    ProductModel.syncIndexes(),
    OrderModel.syncIndexes(),
  ]);
  console.log('[seed] syncIndexes() done — orderNumber unique index ensured');

  await mongoose.disconnect();
  console.log('[seed] complete');
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
