import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';

export const ALICE = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.com' };
export const REPORT_ID = '22222222-2222-4222-8222-222222222222';

// Minimal stand-in for supabase-js. Every query is recorded as an operation
// ({ client, table, action, payload, options, filters, columns }) and resolved
// by the test's `handle(op)` function, which returns { data, error }.
export function createFakeSupabase({ tokens = { 'alice-token': ALICE }, handle = () => ({ data: [], error: null }) } = {}) {
  const ops = [];

  const builder = (client, table) => {
    const op = { client, table, action: 'select', filters: [], payload: undefined, options: undefined, columns: undefined };
    const chain = {
      select(columns) {
        if (op.action === 'select') op.columns = columns;
        else op.returning = columns;
        return chain;
      },
      insert(payload) {
        op.action = 'insert';
        op.payload = payload;
        return chain;
      },
      upsert(payload, options) {
        op.action = 'upsert';
        op.payload = payload;
        op.options = options;
        return chain;
      },
      update(payload) {
        op.action = 'update';
        op.payload = payload;
        return chain;
      },
      delete() {
        op.action = 'delete';
        return chain;
      },
      single() {
        op.single = true;
        return chain;
      },
      maybeSingle() {
        op.single = true;
        return chain;
      },
      then(resolve, reject) {
        ops.push(op);
        return Promise.resolve(handle(op)).then(resolve, reject);
      },
    };
    for (const name of ['eq', 'gt', 'gte', 'lt', 'lte', 'in', 'order', 'limit']) {
      chain[name] = (...args) => {
        op.filters.push([name, ...args]);
        return chain;
      };
    }
    return chain;
  };

  const client = (name) => ({
    from: (table) => builder(name, table),
    rpc: (fn, args) => {
      const op = { client: name, table: fn, action: 'rpc', payload: args, filters: [] };
      ops.push(op);
      return Promise.resolve(handle(op));
    },
  });

  return {
    ops,
    anon: () => client('anon'),
    forUser: (token) => client(`user:${tokens[token]?.id}`),
    verifyToken: async (token) => tokens[token] ?? null,
  };
}

export const silentLogger = { error: () => {}, warn: () => {}, info: () => {}, log: () => {} };

export function buildApp(overrides = {}, env = {}) {
  const config = loadConfig({ RATE_LIMIT_API_PER_15MIN: '10000', RATE_LIMIT_REPORTS_PER_MIN: '1000', ...env });
  return createApp(config, { logger: silentLogger, fetchJson: async () => ({ status: 200, data: {} }), ...overrides });
}

export const authHeader = { Authorization: 'Bearer alice-token' };
