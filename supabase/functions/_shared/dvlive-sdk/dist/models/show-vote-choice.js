/** Public DTOs. Customize field names and transformations in fromResponse(). */
export class EliminatedRound {
    uuid;
    round;
    constructor(uuid, round) {
        this.uuid = uuid;
        this.round = round;
    }
    static fromResponse(response) {
        return new EliminatedRound(response.uuid, response.round);
    }
}
export class ReintroducedRound {
    uuid;
    round;
    constructor(uuid, round) {
        this.uuid = uuid;
        this.round = round;
    }
    static fromResponse(response) {
        return new ReintroducedRound(response.uuid, response.round);
    }
}
export class Choice {
    uuid;
    firstname;
    lastname;
    status;
    constructor(uuid, firstname, lastname, status, bio, desktopPicture, mobilePicture, isNominated) {
        this.uuid = uuid;
        this.firstname = firstname;
        this.lastname = lastname;
        this.status = status;
        if (bio !== undefined)
            this.bio = bio;
        if (desktopPicture !== undefined)
            this.desktopPicture = desktopPicture;
        if (mobilePicture !== undefined)
            this.mobilePicture = mobilePicture;
        if (isNominated !== undefined)
            this.isNominated = isNominated;
    }
    static fromResponse(response) {
        return new Choice(response.uuid, response.firstname, response.lastname, response.status, response.bio, response.desktopPicture, response.mobilePicture, response.isNominated);
    }
}
export class ShowVoteChoice {
    uuid;
    showVoteUuid;
    firstname;
    lastname;
    status;
    order;
    constructor(uuid, showVoteUuid, firstname, lastname, status, order, bio, desktopPicture, mobilePicture, eliminatedRound, reintroducedRound, isNominated) {
        this.uuid = uuid;
        this.showVoteUuid = showVoteUuid;
        this.firstname = firstname;
        this.lastname = lastname;
        this.status = status;
        this.order = order;
        if (bio !== undefined)
            this.bio = bio;
        if (desktopPicture !== undefined)
            this.desktopPicture = desktopPicture;
        if (mobilePicture !== undefined)
            this.mobilePicture = mobilePicture;
        if (eliminatedRound !== undefined)
            this.eliminatedRound = eliminatedRound;
        if (reintroducedRound !== undefined)
            this.reintroducedRound = reintroducedRound;
        if (isNominated !== undefined)
            this.isNominated = isNominated;
    }
    static fromResponse(response) {
        return new ShowVoteChoice(response.uuid, response.showVoteUuid, response.firstname, response.lastname, response.status, response.order, response.bio, response.desktopPicture, response.mobilePicture, response.eliminatedRound == null ? response.eliminatedRound : EliminatedRound.fromResponse(response.eliminatedRound), response.reintroducedRound == null ? response.reintroducedRound : ReintroducedRound.fromResponse(response.reintroducedRound), response.isNominated);
    }
}
//# sourceMappingURL=show-vote-choice.js.map