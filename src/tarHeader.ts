import { MAX_TIMESTAMP } from "./constants.js";
import { writeString, writeOctal } from "./io.js";
import { generateChecksum } from "./utils.js";

export interface TarHeader {
    name: string;
    mode: number;
    uid: number;
    gid: number;
    size: number;
    lastModified: number;
    checksum: number;
    typeflag: number;
    linkname: string;
    version: number;
    uname: string;
    gname: string;
    devmajor?: number;
    devminor?: number;
    prefix: string;
}

export function writeHeader(
    header: TarHeader,
    output: Uint8Array,
    offset: number = 0
): void {
    output = output.subarray(offset, offset + 500);
    writeString(header.name, output, 0, 100);
    writeOctal(header.mode, output, 100, 8);
    writeOctal(header.uid, output, 108, 8);
    writeOctal(header.gid, output, 116, 8);
    writeOctal(header.size, output, 124, 12);
    writeOctal(header.lastModified, output, 136, 12);
    writeOctal(header.checksum, output, 148, 7);
    output[155] = 32;
    writeOctal(header.typeflag, output, 156, 1);
    writeString(header.linkname, output, 157, 100);
    writeString("ustar", output, 257, 6);
    writeOctal(header.version & 63, output, 263, 3);
    writeString(header.uname, output, 265, 32);
    writeString(header.gname, output, 297, 32);
    if (header.devmajor === undefined) {
        output.fill(0, 329, 329 + 8);
    } else {
        writeOctal(header.devmajor, output, 329, 8);
    }
    if (header.devminor === undefined) {
        output.fill(0, 337, 337 + 8);
    } else {
        writeOctal(header.devminor, output, 337, 8);
    }
    writeString(header.prefix, output, 345, 155);
}

export function tarHeader(
    name: string,
    mode: number,
    uid: number,
    gid: number,
    size: number,
    lastModified: number,
    checksum: number | undefined,
    typeflag: number,
    linkname: string,
    version: number,
    uname: string,
    gname: string,
    devmajor: number | undefined,
    devminor: number | undefined,
    prefix: string
): TarHeader {
    lastModified = Math.floor(lastModified / 1000);
    if (lastModified > MAX_TIMESTAMP) {
        lastModified = MAX_TIMESTAMP;
    }

    const header: TarHeader = {
        name,
        mode,
        uid,
        gid,
        size,
        lastModified,
        checksum: checksum ?? 0,
        typeflag,
        linkname,
        version,
        uname,
        gname,
        devmajor,
        devminor,
        prefix,
    };

    if (checksum === undefined) {
        const bytes = new Uint8Array(500);
        writeHeader(header, bytes);

        // Up to 7 octal numbers, 3 bits per number.
        const precision = 7 * 3;
        header.checksum = generateChecksum(bytes, precision);
    }

    return header;
}
