import { pathParameter } from "./validation.js";
export class GetShowVoteRequest {
    uuid;
    constructor(uuid) {
        this.uuid = uuid;
        pathParameter(uuid, "uuid");
        Object.freeze(this);
    }
}
//# sourceMappingURL=show-vote.js.map