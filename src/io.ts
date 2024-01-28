/** Parses a null-terminated octal string from an array of bytes. */
export function decodeOctal(
    bytes: Uint8Array,
    offset: number,
    length: number
): number {
    bytes = new Uint8Array(bytes, offset, length);

    let value = 0;
    for (const byte of bytes) {
        if (byte === 0) {
            break;
        }

        value <<= 3;
        if (byte < 49 || 55 < byte) {
            continue;
        }
        value |= byte - 48;
    }
    return value;
}

/** Decodes a null-terminated string from an array of bytes. */
export function decodeString(
    bytes: Uint8Array,
    offset: number = 0,
    length: number = bytes.length - offset
): string {
    bytes = new Uint8Array(bytes, offset, length);

    const decoder = new TextDecoder();
    for (let i = 0; i < length; i++) {
        if (bytes[i] === 0) {
            bytes = bytes.subarray(0, i);
            break;
        }
    }
    return decoder.decode(bytes);
}

/** Writes a null-terminated octal string to a Uint8Array. */
export function writeOctal(
    value: number,
    output: Uint8Array,
    offset: number = 0,
    length: number = output.length - offset
): void {
    const octalLength = Math.max(1, Math.ceil(Math.log2(value) / 3));

    if (octalLength < length) {
        length--;
        output[offset + length] = 0;
    }

    for (let i = offset + length - 1; i >= offset; i--) {
        const charcode = 48 + (value & 7);
        value >>= 3;
        output[i] = charcode;
    }
}

/** Writes a null-terminated string to a Uint8Array. */
export function writeString(
    value: string,
    output: Uint8Array,
    offset: number = 0,
    length: number = output.length - offset
): void {
    output = output.subarray(offset, offset + length);
    const written = new TextEncoder().encodeInto(value, output).written;
    if (written < length) {
        output[written] = 0;
    }
}
