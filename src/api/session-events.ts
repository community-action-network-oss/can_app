type Handler = () => void;

const handlers = new Set<Handler>();

export const sessionEvents = {
  /** Returns an unsubscribe function. */
  subscribe(handler: Handler): () => void {
    handlers.add(handler);
    return () => void handlers.delete(handler);
  },
  emitExpired() {
    [...handlers].forEach((h) => h());
  },
};
