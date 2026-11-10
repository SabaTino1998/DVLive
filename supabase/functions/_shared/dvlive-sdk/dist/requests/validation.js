import { ApiValidationError } from "../ApiErrors.js";
export function pathParameter(value, name) {
    if (typeof value !== "string" || !value.trim() || value === "." || value === "..") {
        throw new ApiValidationError(`${name} must be a non-empty path parameter.`);
    }
}
export function optionalString(value, name) {
    if (value !== undefined && typeof value !== "string")
        throw new ApiValidationError(`${name} must be a string.`);
}
export function positiveInteger(value, name) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new ApiValidationError(`${name} must be a positive integer.`);
    }
}
//# sourceMappingURL=validation.js.map