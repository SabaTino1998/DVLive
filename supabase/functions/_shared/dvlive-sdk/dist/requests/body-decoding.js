import { ApiValidationError } from "../ApiErrors.js";
/** Unknown JSON is handled only at the decoding boundary. Extra fields are ignored. */
export function bodyObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new ApiValidationError("The request body must be a JSON object.");
    }
    return value;
}
export function string(value, name) {
    if (typeof value !== "string")
        throw new ApiValidationError(`${name} must be a string.`);
    return value;
}
export function optionalString(value, name) {
    return value === undefined ? undefined : string(value, name);
}
export function optionalPhone(value) {
    if (value === undefined || value === null || typeof value === "string")
        return value;
    throw new ApiValidationError("phone must be a string or null.");
}
export function number(value, name) {
    if (typeof value !== "number")
        throw new ApiValidationError(`${name} must be a positive integer.`);
    return value;
}
//# sourceMappingURL=body-decoding.js.map