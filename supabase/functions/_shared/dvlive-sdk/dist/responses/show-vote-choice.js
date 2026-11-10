import { boolean, integer, nullable, object, string } from "./decoding.js";
function decodeChoiceStatus(value, path) {
    switch (value) {
        case "EVICTED":
        case "PRESENT": return value;
        default: throw new TypeError(`${path} must be EVICTED or PRESENT.`);
    }
}
/** Decoded DV Live wire models. Each class owns its validation. */
export class EliminatedRoundResponse {
    uuid;
    round;
    constructor(uuid, round) {
        this.uuid = uuid;
        this.round = round;
    }
    static decode(value, path = "EliminatedRoundResponse") {
        const source = object(value, path);
        const response = new EliminatedRoundResponse(string(source.uuid, `${path}.uuid`), integer(source.round, `${path}.round`));
        return response;
    }
}
export class ReintroducedRoundResponse {
    uuid;
    round;
    constructor(uuid, round) {
        this.uuid = uuid;
        this.round = round;
    }
    static decode(value, path = "ReintroducedRoundResponse") {
        const source = object(value, path);
        const response = new ReintroducedRoundResponse(string(source.uuid, `${path}.uuid`), integer(source.round, `${path}.round`));
        return response;
    }
}
export class ChoiceResponse {
    uuid;
    firstname;
    lastname;
    status;
    constructor(uuid, firstname, lastname, status) {
        this.uuid = uuid;
        this.firstname = firstname;
        this.lastname = lastname;
        this.status = status;
    }
    static decode(value, path = "ChoiceResponse") {
        const source = object(value, path);
        const response = new ChoiceResponse(string(source.uuid, `${path}.uuid`), string(source.firstname, `${path}.firstname`), string(source.lastname, `${path}.lastname`), decodeChoiceStatus(source.status, `${path}.status`));
        if (source.bio !== undefined)
            response.bio = nullable(source.bio, string, `${path}.bio`);
        if (source.desktopPicture !== undefined)
            response.desktopPicture = nullable(source.desktopPicture, string, `${path}.desktopPicture`);
        if (source.mobilePicture !== undefined)
            response.mobilePicture = nullable(source.mobilePicture, string, `${path}.mobilePicture`);
        if (source.isNominated !== undefined)
            response.isNominated = boolean(source.isNominated, `${path}.isNominated`);
        return response;
    }
}
export class ShowVoteChoiceResponse {
    uuid;
    showVoteUuid;
    firstname;
    lastname;
    status;
    order;
    constructor(uuid, showVoteUuid, firstname, lastname, status, order) {
        this.uuid = uuid;
        this.showVoteUuid = showVoteUuid;
        this.firstname = firstname;
        this.lastname = lastname;
        this.status = status;
        this.order = order;
    }
    static decode(value, path = "ShowVoteChoiceResponse") {
        const source = object(value, path);
        const response = new ShowVoteChoiceResponse(string(source.uuid, `${path}.uuid`), string(source.showVoteUuid, `${path}.showVoteUuid`), string(source.firstname, `${path}.firstname`), string(source.lastname, `${path}.lastname`), string(source.status, `${path}.status`), integer(source.order, `${path}.order`));
        if (source.bio !== undefined)
            response.bio = nullable(source.bio, string, `${path}.bio`);
        if (source.desktopPicture !== undefined)
            response.desktopPicture = nullable(source.desktopPicture, string, `${path}.desktopPicture`);
        if (source.mobilePicture !== undefined)
            response.mobilePicture = nullable(source.mobilePicture, string, `${path}.mobilePicture`);
        if (source.eliminatedRound !== undefined)
            response.eliminatedRound = nullable(source.eliminatedRound, EliminatedRoundResponse.decode, `${path}.eliminatedRound`);
        if (source.reintroducedRound !== undefined)
            response.reintroducedRound = nullable(source.reintroducedRound, ReintroducedRoundResponse.decode, `${path}.reintroducedRound`);
        return response;
    }
}
//# sourceMappingURL=show-vote-choice.js.map