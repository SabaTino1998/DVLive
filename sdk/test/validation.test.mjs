import { test } from "node:test";
import assert from "node:assert/strict";
import { CreateVoterBody, AddVoteBody, CastVoteBody, ApiService, ApiValidationError } from "@digitalvirgo/dvlive-api";

import { CastVoteChoiceRequest } from "../dist/requests/voter.js";

import { makeRequest } from "./responses.fixture.mjs";

const config = { environment: "STAG" };
const vote = { choiceUuid: "choice", nbVotes: 1 };
const invalidBodies = {
  createVoter: [undefined, null, [], "body", { email: 1 }, { uniqRef: false }, { phone: 123 }, { email: null }],
  addVote: [undefined, null, [], "body", { additionalVoteType: "INVALID" }, { additionalVoteType: ["VIDEO"] }, { additionalVoteType: null },
    ...[0, -1, 0.5, NaN, Infinity, "1"].map((nbPoints) => ({ nbPoints }))],
  castVote: [undefined, null, [], "body", {}, { unknown: true }, { votes: null }, { votes: {} }, { votes: [] }, { votes: [null] }, { votes: [{}] },
    { votes: [{ ...vote, choiceUuid: " " }] }, { votes: [{ ...vote, choiceUuid: 1 }] },
    ...[0, -1, 0.5, NaN, Infinity, "1"].map((nbVotes) => ({ votes: [{ ...vote, nbVotes }] })),
    ...["sessionToken", "phoneFingerPrint", "ip", "userAgent", "uniqSubscriptionId"].map((key) => ({ votes: [vote], [key]: false }))],
};

for (const [method, bodies] of Object.entries(invalidBodies)) {
  test(`${method} validates runtime bodies before headers or HTTP requests`, async (t) => {
    const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected HTTP request"); });
    let headerCalls = 0;
    const api = new ApiService({ ...config, headers: () => { headerCalls++; return {}; } });
    for (const body of bodies) {
      assert.throws(() => makeRequest(method, { showVoteUuid: "show", userRef: "voter", body }), (error) => {
        assert.ok(error instanceof ApiValidationError);
        assert.equal(error.name, "ApiValidationError");
        assert.ok(error.message);
        return true;
      });
    }
    assert.equal(upstream.mock.callCount(), 0);
    assert.equal(headerCalls, 0);
  });
}

test("valid optional fields and enum values pass validation without mutating requests", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", async () => Response.json({ status: "success", code: 201, message: "Recorded", nbVoteRemaining: 1 }, { status: 201 }));
  const api = new ApiService(config);
  const cases = [
    ["createVoter", {}],
    ["createVoter", { email: "email@example.com", phone: null, uniqRef: "voter" }],
    ["createVoter", { phone: "+33601020304" }],
    ["addVote", {}],
    ...["PURCHASE", "SPONSOR", "VIDEO", "GAME", "REFERAL", "PROMO"].map((additionalVoteType) => ["addVote", { additionalVoteType, nbPoints: 1 }]),
    ["castVote", { votes: [vote] }],
    ["castVote", { votes: [vote], sessionToken: "session", phoneFingerPrint: "fingerprint", ip: "203.0.113.10", userAgent: "agent", uniqSubscriptionId: "subscription" }],
  ];
  for (const [method, body] of cases) {
    const before = structuredClone(body);
    const request = makeRequest(method, { showVoteUuid: "show", userRef: "voter", body });
    const result = await api[method](request);
    assert.equal(result.status, 201);
    assert.deepEqual(body, before);
    const options = upstream.mock.calls.at(-1).arguments[1];
    assert.deepEqual(JSON.parse(options.body), before);
  }
  assert.equal(upstream.mock.callCount(), cases.length);
});

test("body constructors validate typed fields and protect validated state", () => {
  assert.throws(() => new CreateVoterBody({ email: 1 }), ApiValidationError);
  assert.throws(() => new AddVoteBody({ nbPoints: 0 }), ApiValidationError);
  assert.throws(() => new AddVoteBody({ additionalVoteType: "INVALID" }), ApiValidationError);
  assert.throws(() => new CastVoteChoiceRequest(" ", 1), ApiValidationError);
  assert.throws(() => new CastVoteChoiceRequest("choice", -1), ApiValidationError);
  assert.throws(() => new CastVoteBody({ votes: [] }), ApiValidationError);
  assert.throws(() => new CastVoteBody({ votes: [{ choiceUuid: "choice", nbVotes: 1 }] }), ApiValidationError);
  const votes = [new CastVoteChoiceRequest("choice", 1)];
  const body = new CastVoteBody({ votes });
  votes.length = 0;
  assert.equal(body.votes.length, 1);
  assert.throws(() => { body.votes[0].nbVotes = -1; }, TypeError);
  assert.throws(() => body.votes.push(new CastVoteChoiceRequest("other", 1)), TypeError);
});

test("body decoding selects known fields and ignores extra JSON at every level", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(CreateVoterBody.decode({ uniqRef: "voter", extra: true }))), { uniqRef: "voter" });
  assert.deepEqual(JSON.parse(JSON.stringify(AddVoteBody.decode({ nbPoints: 2, extra: true }))), { nbPoints: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(CastVoteBody.decode({ votes: [{ choiceUuid: "choice", nbVotes: 1, extra: true }], extra: true }))), { votes: [{ choiceUuid: "choice", nbVotes: 1 }] });
});
