import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiMode, API_MODES, parseMode, getModeCatalog } from "@digitalvirgo/dvlive-api";

test("every supported query value parses into its SDK enum member", () => {
  assert.deepEqual(Object.values(ApiMode).sort(), ["addVote", "castVote", "createVoter", "getShowVote", "getShowVoteChoice", "getVoter"]);
  for (const mode of Object.values(ApiMode)) {
    assert.deepEqual(parseMode(mode), { mode, catalog: null });
  }
});

test("missing, empty and invalid modes return the complete catalog", () => {
  const catalog = getModeCatalog();
  for (const value of [null, undefined, "", " ", "unknown", "GETSHOWVOTE", "getShowVote ", "constructor", "__proto__", "toString"]) {
    assert.deepEqual(parseMode(value), { mode: null, catalog });
  }
});

test("catalog includes each mode's description, HTTP method and required parameters", () => {
  const expected = {
    [ApiMode.GetShowVote]: ["GET", ["uuid"]],
    [ApiMode.GetShowVoteChoice]: ["GET", ["uuid"]],
    [ApiMode.GetVoter]: ["GET", ["showVoteUuid", "userRef"]],
    [ApiMode.CreateVoter]: ["POST", ["showVoteUuid"]],
    [ApiMode.AddVote]: ["POST", ["showVoteUuid", "userRef"]],
    [ApiMode.CastVote]: ["POST", ["showVoteUuid", "userRef"]],
  };
  const catalog = getModeCatalog();
  assert.equal(catalog.name, "DVLive");
  assert.equal(catalog.modes, API_MODES);
  assert.equal(Object.keys(catalog.modes).length, Object.values(ApiMode).length);
  for (const [mode, [method, params]] of Object.entries(expected)) {
    const definition = catalog.modes[mode];
    assert.equal(definition.method, method);
    assert.deepEqual(definition.params, params);
    assert.match(definition.description, /^(Returns|Registers|Credits|Casts) /);
    assert.ok(definition.response.endsWith("Response"));
    assert.ok(Array.isArray(definition.body));
  }
  assert.deepEqual(catalog.modes[ApiMode.CastVote].requiredBody, ["votes"]);
});
