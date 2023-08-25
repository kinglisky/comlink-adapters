export const isObject = (val: unknown): val is object =>
    (typeof val === 'object' && val !== null) || typeof val === 'function';

export const generateUUID = () => {
    return new Array(4)
        .fill(0)
        .map(() =>
            Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)
        )
        .join('-');
};
