// Independent from React Native so the exact signup/login ordering can be tested.
export interface AuthSdk {
  signupWithEmail(email: string, password: string): Promise<void>;
  loginWithEmail(email: string, password: string): Promise<void>;
  getUserToken(): string;
}
export async function authenticate(sdk: AuthSdk, signup: boolean, email: string, password: string) {
  if (signup) await sdk.signupWithEmail(email, password);
  else await sdk.loginWithEmail(email, password);
  const userToken = sdk.getUserToken();
  if (!userToken?.startsWith('N_')) throw new Error('SmartUser did not return a valid N_ token.');
  return { email, userToken, needsRegistration: signup };
}
