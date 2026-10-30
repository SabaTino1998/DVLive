const pending = new Map<string, Promise<void>>();
// Repeated component mounts must not create two voters for the same signup token.
export async function registerSignupVoter(token: string, create: () => Promise<unknown>) {
  let request = pending.get(token);
  if (!request) {
    request = create().then(() => {});
    pending.set(token, request);
    request.catch(() => { pending.delete(token); });
  }
  return request;
}
