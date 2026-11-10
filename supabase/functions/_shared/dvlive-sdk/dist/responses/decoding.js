/** Small decoding primitives; endpoint decoders select fields explicitly. */
export function object(value, path) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`${path} must be an object.`);
    }
    return value;
}
export function string(value, path) {
    if (typeof value !== "string")
        throw new TypeError(`${path} must be a string.`);
    return value;
}
export function integer(value, path) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new TypeError(`${path} must be an integer.`);
    }
    return value;
}
export function nullable(value, decode, path) {
    return value === null ? null : decode(value, path);
}
export function array(value, decode, path) {
    if (!Array.isArray(value))
        throw new TypeError(`${path} must be an array.`);
    return value.map((item, index) => decode(item, `${path}[${index}]`));
}
//# sourceMappingURL=decoding.js.map