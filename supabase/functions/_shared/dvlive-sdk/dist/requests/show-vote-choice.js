import { pathParameter } from "./validation.js";
export class GetShowVoteChoiceRequest {
    uuid;
    constructor(uuid) {
        this.uuid = uuid;
        pathParameter(uuid, "uuid");
        Object.freeze(this);
    }
}
//# sourceMappingURL=show-vote-choice.js.map