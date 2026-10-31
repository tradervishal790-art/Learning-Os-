// Test double for src/cloudSync.ts: an in-memory "Firestore" that refuses documents over 1 MiB like the real one.
export const store = new Map<string, unknown>();
export const LIMIT = 1_048_576;
export async function pushToCloudChecked(key: string, data: unknown): Promise<boolean> {
  const json = JSON.stringify(data);
  if (json.length > LIMIT) return false;
  store.set(key, JSON.parse(json));
  return true;
}
export async function pullFromCloud<T>(key: string): Promise<T | null> {
  return store.has(key) ? (JSON.parse(JSON.stringify(store.get(key))) as T) : null;
}
export async function deleteFromCloud(key: string): Promise<void> {
  store.delete(key);
}
export function subscribeCloud(): () => void {
  return () => undefined;
}
