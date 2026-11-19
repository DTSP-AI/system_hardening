import { testDb } from "./db";

/** Counts transactions opened on the test client and tracks whether one is open right now. */
export function spyTransactions() {
  const client = testDb as unknown as { $transaction: (...args: unknown[]) => Promise<unknown> };
  const original = client.$transaction.bind(testDb);
  const state = { count: 0, open: 0 };
  client.$transaction = async (...args: unknown[]) => {
    state.count += 1;
    state.open += 1;
    try {
      return await original(...args);
    } finally {
      state.open -= 1;
    }
  };
  return {
    state,
    restore() {
      client.$transaction = original;
    },
  };
}
