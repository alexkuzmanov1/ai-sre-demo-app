/**
 * Collection namespacing.
 *
 * This demo can run against a SHARED Atlas cluster that already holds unrelated
 * data. To guarantee we never create, clear, or index any pre-existing
 * collection, every model binds to a prefixed collection name. `pnpm seed`'s
 * deleteMany() therefore only ever clears these `minishop_*` collections.
 *
 * Override the prefix with COLLECTION_PREFIX in the environment if needed.
 */
export const COLLECTION_PREFIX = process.env.COLLECTION_PREFIX ?? 'minishop_';

export const COLLECTIONS = {
  users: `${COLLECTION_PREFIX}users`,
  products: `${COLLECTION_PREFIX}products`,
  orders: `${COLLECTION_PREFIX}orders`,
} as const;
