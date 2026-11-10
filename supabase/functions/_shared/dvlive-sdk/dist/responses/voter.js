import { integer, nullable, object, string } from "./decoding.js";
function decodeUserFraudStatus(value, path) {
    switch (value) {
        case "CLEAN":
        case "SUSPICIOUS":
        case "BLOCKED":
        case "VERIFIED": return value;
        default: throw new TypeError(`${path} must be a supported voter fraud status.`);
    }
}
function decodeSuccess(value, path) {
    if (value !== "success")
        throw new TypeError(`${path} must be success.`);
    return value;
}
/** Decoded DV Live wire models. Each class owns its validation. */
export class VoterBalanceResponse {
    static decode(value, path = "VoterBalanceResponse") {
        const source = object(value, path);
        const response = new VoterBalanceResponse();
        if (source.standardPoint !== undefined)
            response.standardPoint = integer(source.standardPoint, `${path}.standardPoint`);
        if (source.additionalPoint !== undefined)
            response.additionalPoint = integer(source.additionalPoint, `${path}.additionalPoint`);
        if (source.purchasedPoint !== undefined)
            response.purchasedPoint = integer(source.purchasedPoint, `${path}.purchasedPoint`);
        return response;
    }
}
export class GetVoterResponse {
    uniqRef;
    remainingPoints;
    userFraudStatus;
    balance;
    constructor(uniqRef, remainingPoints, userFraudStatus, balance) {
        this.uniqRef = uniqRef;
        this.remainingPoints = remainingPoints;
        this.userFraudStatus = userFraudStatus;
        this.balance = balance;
    }
    static decode(value, path = "GetVoterResponse") {
        const source = object(value, path);
        const response = new GetVoterResponse(string(source.uniqRef, `${path}.uniqRef`), integer(source.remainingPoints, `${path}.remainingPoints`), decodeUserFraudStatus(source.userFraudStatus, `${path}.userFraudStatus`), VoterBalanceResponse.decode(source.balance, `${path}.balance`));
        if (source.email !== undefined)
            response.email = nullable(source.email, string, `${path}.email`);
        if (source.phone !== undefined)
            response.phone = nullable(source.phone, string, `${path}.phone`);
        return response;
    }
}
export class CreateVoterResponse {
    status;
    code;
    message;
    constructor(status, code, message) {
        this.status = status;
        this.code = code;
        this.message = message;
    }
    static decode(value, path = "CreateVoterResponse") {
        const source = object(value, path);
        const response = new CreateVoterResponse(decodeSuccess(source.status, `${path}.status`), integer(source.code, `${path}.code`), string(source.message, `${path}.message`));
        return response;
    }
}
export class CastVoteResponse {
    status;
    code;
    message;
    nbVoteRemaining;
    constructor(status, code, message, nbVoteRemaining) {
        this.status = status;
        this.code = code;
        this.message = message;
        this.nbVoteRemaining = nbVoteRemaining;
    }
    static decode(value, path = "CastVoteResponse") {
        const source = object(value, path);
        const response = new CastVoteResponse(decodeSuccess(source.status, `${path}.status`), integer(source.code, `${path}.code`), string(source.message, `${path}.message`), integer(source.nbVoteRemaining, `${path}.nbVoteRemaining`));
        return response;
    }
}
//# sourceMappingURL=voter.js.map