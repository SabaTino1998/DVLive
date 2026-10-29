import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiService, ApiValidationError } from "@digitalvirgo/dvlive-api";
import { requestCases, cases } from "./responses.fixture.mjs";

for (const [method, [validInput], , payload] of requestCases) {
  const post = "body" in validInput;
  function args(input, raw = false) {
    if (method === "getShowVote" || method === "getShowVoteChoice") return [input?.uuid];
    if (!post) return [input];
    return raw ? [input, input?.body] : [{ ...input?.body, showVoteUuid: input?.showVoteUuid, userRef: input?.userRef }];
  }

  test(`${method}: invalid public inputs fail before credentials or HTTP calls`, async (t) => {
    const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected HTTP request"); });
    let headerCalls = 0;
    const api = new ApiService({ environment: "STAG", headers: () => { headerCalls++; return {}; } });
    for (const input of [undefined, null, [], "show", 1, false, {}]) {
      await assert.rejects(api[method](...args(input)), ApiValidationError);
    }
    for (const field of ["uuid", "showVoteUuid", "userRef"].filter((field) => field in validInput)) {
      for (const value of [undefined, null, "", " ", ".", "..", 123, {}, []]) {
        await assert.rejects(api[method](...args({ ...validInput, [field]: value })), ApiValidationError);
      }
    }
    if (post) await assert.rejects(api[method](...args({ ...validInput, body: undefined }, true)), ApiValidationError);
    assert.equal(headerCalls, 0);
    assert.equal(upstream.mock.callCount(), 0);
  });

  test(`${method}: plain inputs preserve caller data and serialize only body fields`, async (t) => {
    const api = new ApiService({ environment: "STAG" });
    const publicArgs = structuredClone(cases.find(([name]) => name === method)[1]);
    const before = structuredClone(publicArgs);
    const upstream = t.mock.method(globalThis, "fetch", async (_url, options) => {
      if (post) assert.deepEqual(JSON.parse(options.body), validInput.body);
      else assert.equal(options.body, undefined);
      return Response.json(payload);
    });
    await api[method](...publicArgs);
    assert.deepEqual(publicArgs, before);
    if (post) {
      // Explicit raw JSON overload used by the Edge Function, with no public decoder.
      await api[method]({ showVoteUuid: validInput.showVoteUuid, userRef: validInput.userRef }, validInput.body);
      assert.equal(upstream.mock.callCount(), 2);
    }
  });
}

for (const method of ["createVoter", "addVote", "castVote"]) {
  test(`${method}: raw HTTP input cannot override route identifiers or forward extra fields`, async (t) => {
    const [, [input], expectedPath, payload] = requestCases.find(([name]) => name === method);
    const api = new ApiService({ environment: "STAG" });
    t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url.pathname, expectedPath);
      assert.deepEqual(JSON.parse(options.body), input.body);
      return Response.json(payload);
    });
    await api[method]({ showVoteUuid: input.showVoteUuid, userRef: input.userRef }, {
      ...input.body, showVoteUuid: "untrusted-show", userRef: "untrusted-user", extra: true,
    });
  });
}
