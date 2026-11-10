/** Public DTOs. Customize field names and transformations in fromResponse(). */
export class OperationResult {
    status;
    code;
    message;
    constructor(status, code, message) {
        this.status = status;
        this.code = code;
        this.message = message;
    }
    static fromResponse(response) {
        return new OperationResult(response.status, response.code, response.message);
    }
}
export class CreateVoterResult {
    status;
    code;
    message;
    constructor(status, code, message) {
        this.status = status;
        this.code = code;
        this.message = message;
    }
    static fromResponse(response) {
        return new CreateVoterResult(response.status, response.code, response.message);
    }
}
export class CastVoteResult {
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
    static fromResponse(response) {
        return new CastVoteResult(response.status, response.code, response.message, response.nbVoteRemaining);
    }
}
export class VoterBalance {
    constructor(standardPoint, additionalPoint, purchasedPoint) {
        if (standardPoint !== undefined)
            this.standardPoint = standardPoint;
        if (additionalPoint !== undefined)
            this.additionalPoint = additionalPoint;
        if (purchasedPoint !== undefined)
            this.purchasedPoint = purchasedPoint;
    }
    static fromResponse(response) {
        return new VoterBalance(response.standardPoint, response.additionalPoint, response.purchasedPoint);
    }
}
export class Voter {
    uniqRef;
    remainingPoints;
    userFraudStatus;
    balance;
    constructor(uniqRef, remainingPoints, userFraudStatus, balance, email, phone) {
        this.uniqRef = uniqRef;
        this.remainingPoints = remainingPoints;
        this.userFraudStatus = userFraudStatus;
        this.balance = balance;
        if (email !== undefined)
            this.email = email;
        if (phone !== undefined)
            this.phone = phone;
    }
    static fromResponse(response) {
        return new Voter(response.uniqRef, response.remainingPoints, response.userFraudStatus, VoterBalance.fromResponse(response.balance), response.email, response.phone);
    }
}
//# sourceMappingURL=voter.js.map