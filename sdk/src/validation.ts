import { ApiValidationError } from "./errors.ts";
import { ApiMode, API_MODES } from "./modes.ts";
import type { CreateVoterRequest, AddVoteRequest, CastVoteRequest } from "./models/voter.ts";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateBody(mode: ApiMode, body: unknown): asserts body is JsonObject {
  if (!isObject(body)) throw new ApiValidationError("The request body must be a JSON object.");
  const unknown = Object.keys(body).filter((key) => !API_MODES[mode].body.includes(key));
  if (unknown.length) throw new ApiValidationError(`Unknown body fields: ${unknown.join(", ")}.`);
}

function validateStrings(body: JsonObject, fields: readonly string[]): void {
  for (const key of fields) {
    if (body[key] !== undefined && typeof body[key] !== "string") {
      throw new ApiValidationError(`${key} must be a string.`);
    }
  }
}

export function validateCreateVoter(body: unknown): asserts body is CreateVoterRequest {
  validateBody(ApiMode.CreateVoter, body);
  validateStrings(body, ["email", "uniqRef"]);
  if (body.phone !== undefined && body.phone !== null && typeof body.phone !== "string") {
    throw new ApiValidationError("phone must be a string or null.");
  }
}

export function validateAddVote(body: unknown): asserts body is AddVoteRequest {
  validateBody(ApiMode.AddVote, body);
  if (body.additionalVoteType !== undefined && (typeof body.additionalVoteType !== "string" || !["PURCHASE", "SPONSOR", "VIDEO", "GAME", "REFERAL", "PROMO"].includes(body.additionalVoteType))) {
    throw new ApiValidationError("Invalid additionalVoteType.");
  }
  if (body.nbPoints !== undefined && (typeof body.nbPoints !== "number" || !Number.isInteger(body.nbPoints) || body.nbPoints <= 0)) {
    throw new ApiValidationError("nbPoints must be a positive integer.");
  }
}

function validVote(value: unknown): boolean {
  return isObject(value) && typeof value.choiceUuid === "string" && !!value.choiceUuid.trim()
    && typeof value.nbVotes === "number" && Number.isInteger(value.nbVotes) && value.nbVotes > 0;
}

export function validateCastVote(body: unknown): asserts body is CastVoteRequest {
  validateBody(ApiMode.CastVote, body);
  validateStrings(body, ["sessionToken", "phoneFingerPrint", "ip", "userAgent", "uniqSubscriptionId"]);
  if (!Array.isArray(body.votes) || !body.votes.length || !body.votes.every(validVote)) {
    throw new ApiValidationError("votes must contain at least one object with choiceUuid and nbVotes as a positive integer.");
  }
}
