import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ApiService, ApiResponseError } from "@digitalvirgo/dvlive-api";
import { ShowVoteResponse } from "../dist/responses/show-vote.js";
import { ShowVoteChoiceResponse } from "../dist/responses/show-vote-choice.js";
import { GetVoterResponse, CreateVoterResponse, AddVoteResponse, CastVoteResponse } from "../dist/responses/voter.js";
import { cases, show, choice, voter } from "./responses.fixture.mjs";

const specification = JSON.parse(await readFile(new URL("../../runner/openapi.json", import.meta.url), "utf8"));
const endpoints = [
  ["getShowVote", ShowVoteResponse, "ShowVoteResponse"],
  ["getShowVoteChoice", ShowVoteChoiceResponse, "ShowVoteChoiceResponse"],
  ["getVoter", GetVoterResponse, "GetVoterResponse"],
  ["createVoter", CreateVoterResponse, "OperationResult"],
  ["addVote", AddVoteResponse, "OperationResult"],
  ["castVote", CastVoteResponse, "OperationResult"],
];

for (const [method, ResponseType, schemaName] of endpoints) {
  const decode = ResponseType.decode;
  const [, args, , payload] = cases.find(([name]) => name === method);
  const schema = specification.components.schemas[schemaName];
  const fields = [...schema.required, ...(["addVote", "castVote"].includes(method) ? ["nbVoteRemaining"] : [])];

  test(`${method}: decoder enforces every required field from the OpenAPI contract`, () => {
    const decoded = decode({ ...payload, upstreamOnly: true });
    assert.ok(decoded instanceof ResponseType);
    assert.deepEqual(JSON.parse(JSON.stringify(decoded)), payload);
    assert.equal(Object.hasOwn(decoded, "upstreamOnly"), false);
    for (const field of fields) {
      const absent = { ...payload };
      delete absent[field];
      assert.throws(() => decode(absent), { name: "TypeError" }, `Missing ${field}`);
      const type = schema.properties[field]?.type ?? "integer";
      const wrongValues = type === "string" ? [null, 12, false, {}, []]
        : type === "integer" ? [null, "1", 1.5, NaN, Infinity, false, {}]
        : [null, "object", [], false];
      for (const value of wrongValues) {
        assert.throws(() => decode({ ...payload, [field]: value }), { name: "TypeError" }, `Invalid ${field}`);
      }
    }
    for (const value of [undefined, null, [], "text", 1, false]) assert.throws(() => decode(value), TypeError);
  });

  test(`${method}: decoding failures retain the original body, status, headers and field diagnostic`, async (t) => {
    const invalid = { ...payload };
    delete invalid[fields[0]];
    const text = JSON.stringify(invalid);
    const upstream = t.mock.method(globalThis, "fetch", async () => new Response(text, {
      status: 200, headers: { "X-Request-Id": "invalid-response" },
    }));
    await assert.rejects(new ApiService({ environment: "STAG" })[method](...args), (error) => {
      assert.ok(error instanceof ApiResponseError);
      assert.equal(error.status, 200);
      assert.equal(error.bodyText, text);
      assert.equal(error.headers.get("x-request-id"), "invalid-response");
      assert.ok(error.cause instanceof TypeError);
      assert.ok(error.cause.message.includes(fields[0]));
      return true;
    });
    assert.equal(upstream.mock.callCount(), 1);
  });
}

test("decoders validate nested objects, optional fields, arrays and enum values", () => {
  const round = { currentRound: 1, startDay: "start", endDay: "end", name: "Round", choices: [{ uuid: "choice", firstname: "First", lastname: "Last" }] };
  for (const invalidRound of [false, [], {}, { ...round, choices: null }, { ...round, choices: [null] },
    { ...round, choices: [{ uuid: "choice", firstname: "First" }] }, { ...round, currentRound: "1" }]) {
    assert.throws(() => ShowVoteResponse.decode({ ...show, round: invalidRound }), TypeError);
  }
  for (const field of ["bio", "desktopPicture", "mobilePicture"]) {
    assert.throws(() => ShowVoteChoiceResponse.decode({ ...choice, [field]: 1 }), TypeError);
    assert.equal(ShowVoteChoiceResponse.decode({ ...choice, [field]: null })[field], null);
    assert.equal(ShowVoteChoiceResponse.decode({ ...choice, [field]: "" })[field], "");
  }
  for (const field of ["eliminatedRound", "reintroducedRound"]) {
    for (const value of [[], {}, { uuid: "round", round: "1" }, { uuid: null, round: 1 }]) {
      assert.throws(() => ShowVoteChoiceResponse.decode({ ...choice, [field]: value }), TypeError);
    }
    assert.equal(ShowVoteChoiceResponse.decode({ ...choice, [field]: null })[field], null);
  }
  for (const field of ["email", "phone"]) {
    assert.throws(() => GetVoterResponse.decode({ ...voter, [field]: false }), TypeError);
    assert.equal(GetVoterResponse.decode({ ...voter, [field]: null })[field], null);
  }
  for (const field of ["standardPoint", "additionalPoint", "purchasedPoint"]) {
    for (const value of [null, "1", 0.5]) {
      assert.throws(() => GetVoterResponse.decode({ ...voter, balance: { [field]: value } }), TypeError);
    }
  }
  for (const value of ["UNKNOWN", "clean", null, 1]) {
    assert.throws(() => GetVoterResponse.decode({ ...voter, userFraudStatus: value }), TypeError);
  }
  for (const value of ["CLEAN", "SUSPICIOUS", "BLOCKED", "VERIFIED"]) {
    assert.equal(GetVoterResponse.decode({ ...voter, userFraudStatus: value }).userFraudStatus, value);
  }
  for (const ResponseType of [CreateVoterResponse, AddVoteResponse, CastVoteResponse]) {
    const decode = ResponseType.decode;
    for (const status of ["error", "SUCCESS", null]) {
      assert.throws(() => decode({ status, code: 201, message: "Recorded", nbVoteRemaining: 0 }), TypeError);
    }
  }
});

test("nested decoding errors identify the full field path", () => {
  assert.throws(() => ShowVoteResponse.decode({ ...show, round: {
    currentRound: 1, startDay: "start", endDay: "end", name: "Round", choices: [{ uuid: 123 }],
  } }), { message: "ShowVoteResponse.round.choices[0].uuid must be a string." });
});
