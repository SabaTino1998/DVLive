import { ApiValidationError } from "../ApiErrors.js";
import { bodyObject, string, optionalString as decodeOptionalString, optionalPhone, number } from "./body-decoding.js";
import { pathParameter, optionalString, positiveInteger } from "./validation.js";
export class CreateVoterBody {
    constructor(fields = {}) {
        if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
            throw new ApiValidationError("Body fields must be an object.");
        }
        optionalString(fields.email, "email");
        optionalString(fields.uniqRef, "uniqRef");
        if (fields.phone !== undefined && fields.phone !== null && typeof fields.phone !== "string") {
            throw new ApiValidationError("phone must be a string or null.");
        }
        if (fields.email !== undefined)
            this.email = fields.email;
        if (fields.phone !== undefined)
            this.phone = fields.phone;
        if (fields.uniqRef !== undefined)
            this.uniqRef = fields.uniqRef;
        Object.freeze(this);
    }
    static decode(value) {
        const source = bodyObject(value);
        return new CreateVoterBody({
            email: decodeOptionalString(source.email, "email"),
            phone: optionalPhone(source.phone),
            uniqRef: decodeOptionalString(source.uniqRef, "uniqRef"),
        });
    }
}
export class CastVoteChoiceRequest {
    choiceUuid;
    nbVotes;
    constructor(choiceUuid, nbVotes) {
        this.choiceUuid = choiceUuid;
        this.nbVotes = nbVotes;
        pathParameter(choiceUuid, "choiceUuid");
        positiveInteger(nbVotes, "nbVotes");
        Object.freeze(this);
    }
    static decode(value) {
        const source = bodyObject(value);
        return new CastVoteChoiceRequest(string(source.choiceUuid, "choiceUuid"), number(source.nbVotes, "nbVotes"));
    }
}
export class CastVoteBody {
    votes;
    constructor(fields) {
        if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
            throw new ApiValidationError("Body fields must be an object.");
        }
        if (!Array.isArray(fields.votes) || !fields.votes.length || !fields.votes.every((vote) => vote instanceof CastVoteChoiceRequest)) {
            throw new ApiValidationError("votes must contain at least one CastVoteChoiceRequest.");
        }
        optionalString(fields.sessionToken, "sessionToken");
        optionalString(fields.phoneFingerPrint, "phoneFingerPrint");
        optionalString(fields.ip, "ip");
        optionalString(fields.userAgent, "userAgent");
        optionalString(fields.uniqSubscriptionId, "uniqSubscriptionId");
        this.votes = Object.freeze([...fields.votes]);
        if (fields.sessionToken !== undefined)
            this.sessionToken = fields.sessionToken;
        if (fields.phoneFingerPrint !== undefined)
            this.phoneFingerPrint = fields.phoneFingerPrint;
        if (fields.ip !== undefined)
            this.ip = fields.ip;
        if (fields.userAgent !== undefined)
            this.userAgent = fields.userAgent;
        if (fields.uniqSubscriptionId !== undefined)
            this.uniqSubscriptionId = fields.uniqSubscriptionId;
        Object.freeze(this);
    }
    static decode(value) {
        const source = bodyObject(value);
        if (!Array.isArray(source.votes) || !source.votes.length) {
            throw new ApiValidationError("votes must contain at least one object with choiceUuid and nbVotes as a positive integer.");
        }
        return new CastVoteBody({
            votes: source.votes.map((vote) => CastVoteChoiceRequest.decode(vote)),
            sessionToken: decodeOptionalString(source.sessionToken, "sessionToken"),
            phoneFingerPrint: decodeOptionalString(source.phoneFingerPrint, "phoneFingerPrint"),
            ip: decodeOptionalString(source.ip, "ip"),
            userAgent: decodeOptionalString(source.userAgent, "userAgent"),
            uniqSubscriptionId: decodeOptionalString(source.uniqSubscriptionId, "uniqSubscriptionId"),
        });
    }
}
export class GetVoterRequest {
    showVoteUuid;
    userRef;
    constructor(showVoteUuid, userRef) {
        this.showVoteUuid = showVoteUuid;
        this.userRef = userRef;
        pathParameter(showVoteUuid, "showVoteUuid");
        pathParameter(userRef, "userRef");
        Object.freeze(this);
    }
}
export class CreateVoterRequest {
    showVoteUuid;
    body;
    constructor(showVoteUuid, body) {
        this.showVoteUuid = showVoteUuid;
        this.body = body;
        pathParameter(showVoteUuid, "showVoteUuid");
        if (!(body instanceof CreateVoterBody))
            throw new ApiValidationError("body must be a CreateVoterBody.");
        Object.freeze(this);
    }
}
export class CastVoteRequest {
    showVoteUuid;
    userRef;
    body;
    constructor(showVoteUuid, userRef, body) {
        this.showVoteUuid = showVoteUuid;
        this.userRef = userRef;
        this.body = body;
        pathParameter(showVoteUuid, "showVoteUuid");
        pathParameter(userRef, "userRef");
        if (!(body instanceof CastVoteBody))
            throw new ApiValidationError("body must be a CastVoteBody.");
        Object.freeze(this);
    }
}
//# sourceMappingURL=voter.js.map