/**
 * Minimaler Änderungs-Bus: Repositories melden Schreibvorgänge,
 * UI-Hooks laden daraufhin neu. Unabhängig vom Speicher (Dexie heute, Supabase später).
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function notifyDataChanged() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeDataChanges(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDataVersion() {
  return version;
}
