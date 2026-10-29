import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiModes, API_MODES, parseMode, getModeCatalog } from "@digitalvirgo/dvlive-api";

test("every supported query value parses into its SDK enum member", () => {
  assert.deepEqual(Object.values(ApiModes).sort(), ["castVote", "createVoter", "getShowVote", "getShowVoteChoice", "getVoter"]);
  for (const mode of Object.values(ApiModes)) {
    assert.deepEqual(parseMode(mode), { mode, catalog: null });
  }
});

test("missing, empty and invalid modes return the complete catalog", () => {
  const catalog = getModeCatalog();
  for (const value of [null, undefined, "", " ", "unknown", "addVote", "GETSHOWVOTE", "getShowVote ", "constructor", "__proto__", "toString"]) {
    assert.deepEqual(parseMode(value), { mode: null, catalog });
  }
});

test("catalog includes each mode's description, HTTP method and required parameters", () => {
  const expected = {
    [ApiModes.GetShowVote]: ["GET", ["uuid"]],
    [ApiModes.GetShowVoteChoice]: ["GET", ["uuid"]],
    [ApiModes.GetVoter]: ["GET", ["showVoteUuid", "userRef"]],
    [ApiModes.CreateVoter]: ["POST", ["showVoteUuid"]],
    [ApiModes.CastVote]: ["POST", ["showVoteUuid", "userRef"]],
  };
  const catalog = getModeCatalog();
  assert.equal(catalog.name, "DVLive");
  assert.equal(catalog.modes, API_MODES);
  assert.equal(Object.keys(catalog.modes).length, Object.values(ApiModes).length);
  for (const [mode, [method, params]] of Object.entries(expected)) {
    const definition = catalog.modes[mode];
    assert.equal(definition.method, method);
    assert.deepEqual(definition.params, params);
    assert.match(definition.description, /^(Returns|Registers|Credits|Casts) /);
    assert.equal(definition.response, {
      getShowVote: "ShowVote", getShowVoteChoice: "ShowVoteChoice", getVoter: "Voter",
      createVoter: "CreateVoterResult", castVote: "CastVoteResult",
    }[mode]);
    assert.ok(Array.isArray(definition.body));
  }
  assert.deepEqual(catalog.modes[ApiModes.CastVote].requiredBody, ["votes"]);
});
