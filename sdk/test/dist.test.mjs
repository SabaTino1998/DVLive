import { test } from "node:test";
import assert from "node:assert/strict";
import * as SDK from "@digitalvirgo/dvlive-api";
import { ApiResponse, ShowVote, ApiService, ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError } from "@digitalvirgo/dvlive-api";

test("built ESM package resolves exports and returns data with HTTP metadata", async (t) => {
  for (const error of [ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError]) assert.equal(typeof error, "function");
  t.mock.method(globalThis, "fetch", async () => Response.json({ name: "Show", startDate: "2026-01-01", endDate: "2026-12-31" }, { status: 200, headers: { "X-Request-Id": "built" } }));
  const result = await new ApiService({ environment: "STAG" }).getShowVote("show");
  assert.ok(result instanceof ApiResponse);
  assert.ok(result.data instanceof ShowVote);
  assert.equal(result.data.name, "Show");
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("x-request-id"), "built");
});

test("package root exposes services and models while keeping request and body classes internal", () => {
  for (const name of ["GetShowVoteRequest", "GetShowVoteChoiceRequest", "GetVoterRequest", "CreateVoterRequest",
    "AddVoteRequest", "CastVoteRequest", "CastVoteChoiceRequest", "CreateVoterBody", "AddVoteBody", "CastVoteBody"]) {
    assert.equal(Object.hasOwn(SDK, name), false, name);
  }
  assert.equal(typeof SDK.ApiService, "function");
  assert.equal(typeof SDK.ShowVote, "function");
  assert.equal(typeof SDK.parseMode, "function");
  assert.equal(typeof SDK.ApiModes, "object");
});
