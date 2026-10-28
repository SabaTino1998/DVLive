import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiService, ApiValidationError } from "@digitalvirgo/dvlive-api";
import { cases, makeRequest } from "./responses.fixture.mjs";

for (const [method, [validRequest]] of cases) {
  test(`${method}: malformed request objects fail before credentials or HTTP calls`, async (t) => {
    const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected HTTP request"); });
    let headerCalls = 0;
    const api = new ApiService({ environment: "STAG", headers: () => { headerCalls++; return {}; } });
    for (const request of [undefined, null, [], "show", 1, false, {}, { ...validRequest, unexpected: true }]) {
      await assert.rejects(api[method](request), ApiValidationError);
    }
    for (const field of ["uuid", "showVoteUuid", "userRef"].filter((field) => field in validRequest)) {
      const missing = { ...validRequest };
      delete missing[field];
      assert.throws(() => makeRequest(method, missing), ApiValidationError);
      for (const value of [undefined, null, "", " ", ".", "..", 123, {}, []]) {
        assert.throws(() => makeRequest(method, { ...validRequest, [field]: value }), ApiValidationError);
      }
    }
    if ("body" in validRequest) {
      const missing = { ...validRequest };
      delete missing.body;
      assert.throws(() => makeRequest(method, missing), ApiValidationError);
    }
    assert.equal(headerCalls, 0);
    assert.equal(upstream.mock.callCount(), 0);
  });

  test(`${method}: the request object is preserved and only its body is serialized`, async (t) => {
    const payload = cases.find(([name]) => name === method)[3];
    const request = validRequest;
    const before = JSON.stringify(request);
    t.mock.method(globalThis, "fetch", async (_url, options) => {
      assert.equal(options.body, request.body === undefined ? undefined : JSON.stringify(request.body));
      return Response.json(payload);
    });
    await new ApiService({ environment: "STAG" })[method](request);
    assert.equal(JSON.stringify(request), before);
    assert.ok(Object.isFrozen(request));
  });
}
