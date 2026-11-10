import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiResponse, ShowVote, Round, Choice, ShowVoteChoice, EliminatedRound, ReintroducedRound,
  Voter, VoterBalance, CreateVoterResult, CastVoteResult,
} from "@digitalvirgo/dvlive-api";
import { cases, show, choice, voter } from "./responses.fixture.mjs";

for (const [method, Model] of [
  ["getShowVote", ShowVote], ["getShowVoteChoice", ShowVoteChoice], ["getVoter", Voter],
  ["createVoter", CreateVoterResult], ["castVote", CastVoteResult],
]) {
  test(`${method}: model factory selects fields without modifying the response`, () => {
    const payload = cases.find(([name]) => name === method)[3];
    const response = Object.freeze({ ...payload, upstreamOnly: "private" });
    const dto = Model.fromResponse(response);
    assert.ok(dto instanceof Model);
    assert.deepEqual(JSON.parse(JSON.stringify(dto)), payload);
    assert.notEqual(dto, response);
    assert.equal(response.upstreamOnly, "private");
  });
}

test("nested DTOs are independent of service response objects", () => {
  const response = { ...show, round: {
    currentRound: 1, startDay: "start", endDay: "end", name: "Round", upstreamOnly: true,
    choices: [{ uuid: "choice", firstname: "First", lastname: "Last", status: "PRESENT", upstreamOnly: true }],
  } };
  const dto = ShowVote.fromResponse(response);
  assert.ok(dto.round instanceof Round);
  assert.ok(dto.round.choices[0] instanceof Choice);
  assert.notEqual(dto.round, response.round);
  assert.notEqual(dto.round.choices, response.round.choices);
  assert.equal(Object.hasOwn(dto.round, "upstreamOnly"), false);
  assert.equal(Object.hasOwn(dto.round.choices[0], "upstreamOnly"), false);
  dto.round.choices[0].firstname = "Changed";
  assert.equal(response.round.choices[0].firstname, "First");

  const participant = { ...choice, eliminatedRound: { uuid: "round", round: 1 }, reintroducedRound: { uuid: "round", round: 2 } };
  const mappedParticipant = ShowVoteChoice.fromResponse(participant);
  assert.ok(mappedParticipant.eliminatedRound instanceof EliminatedRound);
  assert.ok(mappedParticipant.reintroducedRound instanceof ReintroducedRound);
  assert.notEqual(mappedParticipant.eliminatedRound, participant.eliminatedRound);
  assert.notEqual(mappedParticipant.reintroducedRound, participant.reintroducedRound);
  const mappedVoter = Voter.fromResponse(voter);
  assert.ok(mappedVoter.balance instanceof VoterBalance);
  assert.notEqual(mappedVoter.balance, voter.balance);
});

test("constructors preserve absent and null fields and expose only serializable instance data", () => {
  const show = new ShowVote("Show", "start", "end");
  assert.equal(Object.hasOwn(show, "round"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(show)), { name: "Show", startDate: "start", endDate: "end" });
  assert.equal(new ShowVote("Show", "start", "end", null).round, null);
  const participant = new Choice("choice", "First", "Last", "PRESENT", null);
  assert.equal(participant.bio, null);
  assert.equal(Object.hasOwn(participant, "desktopPicture"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(new VoterBalance(0, 2))), { standardPoint: 0, additionalPoint: 2 });
  const response = new ApiResponse(show, 200, new Headers({ "X-Request-Id": "request" }));
  assert.ok(response instanceof ApiResponse);
  assert.equal(response.data, show);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "request");
});
