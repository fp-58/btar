/** Normalizes a path. */
export function normalizePath(path: string): string {
    const entries = path.split("/");

    for (let i = 0; i < entries.length; i++) {
        switch (entries[i]) {
            case "":
            case ".":
                entries.splice(i, 1);
                i--;
                break;

            case "..":
                if (i >= 1) {
                    entries.splice(i - 1, 2);
                    i -= 2;
                }
                break;

            default:
                break;
        }
    }

    return entries.join("/");
}

/** Splits filename into a prefix and name. */
export function splitFilename(path: string) {
    if (path.length > 255) {
        throw new Error(`Path is too long: ${path.length} > 255`);
    }

    let _name = path;
    let _prefix = "";
    if (path.length > 100) {
        let sepIndex = path.length - 100;
        _name = path.substring(sepIndex);
        _prefix = path.substring(0, sepIndex);
    }
    return { _name, _prefix };
}

/** Returns whether or not all bytes are zero. */
export function isZeroed(bytes: Uint8Array): boolean {
    return bytes.every((v) => v === 0);
}

/** Generate a checksum of an array of bytes with a given precision. */
export function generateChecksum(bytes: Uint8Array, precision: number): number {
    const mask = (2 << precision) - 1;
    const chksumStart = 148;
    const chksumEnd = 155;

    let value = 0;
    for (let i = 0; i < bytes.length; i++) {
        let byte = bytes[i];
        if (chksumStart <= i && i <= chksumEnd) {
            byte = 32;
        }
        value = (value + byte) & mask;
    }
    return value;
}
