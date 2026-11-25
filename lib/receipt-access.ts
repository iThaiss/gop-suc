export function receiptPath(code: string, actionToken?: string | null) {
  const query = `?ma=${encodeURIComponent(code)}`;
  const fragment = actionToken ? `#k=${encodeURIComponent(actionToken)}` : "";
  return `/tra-cuu${query}${fragment}`;
}

export function receiptAccessFromFragment(fragment: string) {
  const token = /^#k=([a-f0-9]{64})$/.exec(fragment)?.[1];
  return token ?? null;
}
