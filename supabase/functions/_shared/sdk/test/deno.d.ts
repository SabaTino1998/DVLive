/** Minimal host declarations for checking the Edge Function with tsc. Not shipped. */
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
