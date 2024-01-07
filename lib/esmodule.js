const BLOCK_SIZE = 512;
const MAX_TIMESTAMP = 0o777777777777;
const FILE_TYPE = 0;
const LINK_TYPE = 1;
const SYMLINK_TYPE = 2;
const CHARDEV_TYPE = 3;
const BLOCKDEV_TYPE = 4;
const DIR_TYPE = 5;
const FIFO_TYPE = 6;
const DEF_FILEMODE = 0o644;
const DEF_DIRMODE = 0o775;
const DEF_UID = 0;
const DEF_GID = 0;
const DEF_UNAME = "";
const DEF_GNAME = "";
export class TarArchive {
    #indexMap = new Map();
    #entries = [];
    addFile(path, file, options) {
        path = normalizePath(path);
        const filename = splitFilename(path);
        const header = tarHeader(filename._name, options?.mode ?? DEF_FILEMODE, options?.uid ?? DEF_UID, options?.gid ?? DEF_GID, file.size, file.lastModified, undefined, FILE_TYPE, "", 0, options?.uname ?? DEF_UNAME, options?.gname ?? DEF_GNAME, undefined, undefined, filename._prefix);
        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header, content: file });
    }
    #addLink(type, path, target, options) {
        path = normalizePath(path);
        const filename = splitFilename(path);
        let trailingSep = target.endsWith("/");
        target = normalizePath(path);
        if (trailingSep) {
            target += "/";
        }
        const header = tarHeader(filename._name, options?.mode ?? DEF_FILEMODE, options?.uid ?? DEF_UID, options?.gid ?? DEF_GID, 0, options?.lastModified ?? Date.now(), undefined, type, target, 0, options?.uname ?? DEF_UNAME, options?.gname ?? DEF_GNAME, undefined, undefined, filename._prefix);
        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }
    addHardlink(path, target, options) {
        this.#addLink(LINK_TYPE, path, target, options);
    }
    addSymlink(path, target, options) {
        this.#addLink(SYMLINK_TYPE, path, target, options);
    }
    addDir(path, options) {
        path = normalizePath(path) + "/";
        const filename = splitFilename(path);
        const header = tarHeader(filename._name, options?.mode ?? DEF_DIRMODE, options?.uid ?? DEF_UID, options?.gid ?? DEF_GID, 0, options?.lastModified ?? Date.now(), undefined, DIR_TYPE, "", 0, options?.uname ?? DEF_UNAME, options?.gname ?? DEF_GNAME, undefined, undefined, filename._prefix);
        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }
    #addDevice(type, path, majorId, minorId, options) {
        path = normalizePath(path);
        const filename = splitFilename(path);
        const header = tarHeader(filename._name, options?.mode ?? DEF_FILEMODE, options?.uid ?? DEF_UID, options?.gid ?? DEF_GID, 0, options?.lastModified ?? Date.now(), undefined, type, "", 0, options?.uname ?? DEF_UNAME, options?.gname ?? DEF_GNAME, majorId, minorId, filename._prefix);
        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }
    addCharDevice(path, majorId, minorId, options) {
        this.#addDevice(CHARDEV_TYPE, path, majorId, minorId, options);
    }
    addBlockDevice(path, majorId, minorId, options) {
        this.#addDevice(BLOCKDEV_TYPE, path, majorId, minorId, options);
    }
    addFIFO(path, options) {
        path = normalizePath(path);
        const filename = splitFilename(path);
        const header = tarHeader(filename._name, options?.mode ?? DEF_FILEMODE, options?.uid ?? DEF_UID, options?.gid ?? DEF_GID, 0, options?.lastModified ?? Date.now(), undefined, FIFO_TYPE, "", 0, options?.uname ?? DEF_UNAME, options?.gname ?? DEF_GNAME, undefined, undefined, filename._prefix);
        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }
    get length() {
        return this.#entries.length;
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    *entries() {
        for (let i = 0; i < this.#entries.length; i++) {
            yield this.entryAt(i);
        }
    }
    entryAt(index) {
        const entry = this.#entries[index];
        if (!entry) {
            return undefined;
        }
        const header = Object.assign({}, entry.header);
        if (entry.content) {
            return { header, content: entry.content };
        }
        else {
            return { header };
        }
    }
    indexOf(path) {
        let mappedIndex = this.#indexMap.get(path);
        if (mappedIndex === undefined) {
            for (let i = this.#entries.length - 1; i >= 0; i--) {
                const entry = this.#entries[i];
                const fullpath = entry.header.prefix + entry.header.name;
                if (fullpath === path) {
                    this.#indexMap.set(path, i);
                    return i;
                }
            }
            return -1;
        }
        else {
            return mappedIndex;
        }
    }
    removeAt(index) {
        if (index < 0 || this.#entries.length <= index) {
            return;
        }
        this.#entries.splice(index, 1);
        for (const [path, i] of this.#indexMap) {
            if (i < index)
                continue;
            this.#indexMap.set(path, i - 1);
        }
    }
    removeEntry(path) {
        for (let i = this.#indexMap.get(path) ?? (this.#entries.length - 1); i >= 0; i--) {
            const entry = this.#entries[i];
            const fullpath = entry.header.prefix + entry.header.name;
            if (fullpath === path) {
                this.removeAt(i);
            }
        }
    }
    static async fromBlob(file) {
        let blockIndex = 0;
        const result = new TarArchive();
        for (let header = await readHeader(); header; header = await readHeader()) {
            let start = blockIndex * BLOCK_SIZE;
            let end = start + header.size;
            if (file.size < end) {
                throw new Error(`Malformed archive: Expected size ${end}, got size ${file.size}`);
            }
            if (header.typeflag !== CHARDEV_TYPE &&
                header.typeflag !== BLOCKDEV_TYPE) {
                header.devmajor = header.devminor = undefined;
            }
            let fullpath = header.prefix + header.name;
            const content = new File([file.slice(start, end)], fullpath, {
                lastModified: header.lastModified,
                endings: "transparent"
            });
            result.#indexMap.set(fullpath, result.#entries.length);
            result.#entries.push({ header, content });
            blockIndex += Math.ceil(header.size / BLOCK_SIZE);
        }
        return result;
        async function readHeader() {
            const headerBlock = await nextBlock();
            if (isZeroed(headerBlock)) {
                const nextHeaderBlock = await peekBlock();
                if (isZeroed(nextHeaderBlock)) {
                    return null;
                }
            }
            return tarHeader(decodeString(headerBlock, 0x000, 100), decodeOctal(headerBlock, 0x064, 8), decodeOctal(headerBlock, 0x06c, 8), decodeOctal(headerBlock, 0x074, 8), decodeOctal(headerBlock, 0x07c, 12), decodeOctal(headerBlock, 0x088, 12), decodeOctal(headerBlock, 0x094, 8), decodeOctal(headerBlock, 0x09c, 1), decodeString(headerBlock, 0x09d, 100), decodeOctal(headerBlock, 0x107, 3), decodeString(headerBlock, 0x109, 32), decodeString(headerBlock, 0x129, 32), decodeOctal(headerBlock, 0x149, 8), decodeOctal(headerBlock, 0x151, 8), decodeString(headerBlock, 0x159, 155));
        }
        async function peekBlock() {
            let start = blockIndex * blockIndex;
            let end = start + BLOCK_SIZE;
            if (file.size < start) {
                return new Uint8Array(BLOCK_SIZE);
            }
            else if (file.size < end) {
                const block = new Uint8Array(BLOCK_SIZE);
                const slice = file.slice(start);
                const data = new Uint8Array(await slice.arrayBuffer());
                block.set(data);
                return block;
            }
            else {
                const slice = file.slice(start, end);
                return new Uint8Array(await slice.arrayBuffer());
            }
        }
        async function nextBlock() {
            const block = await peekBlock();
            if (file.size - blockIndex * BLOCK_SIZE > -BLOCK_SIZE) {
                blockIndex++;
            }
            return block;
        }
    }
    trim() {
        let entrySet = new Set();
        for (let i = this.#entries.length - 1; i >= 0; i--) {
            const entry = this.#entries[i];
            const path = entry.header.prefix + entry.header.name;
            if (!entrySet.has(path)) {
                entrySet.add(path);
            }
            else {
                this.#entries.splice(i, 1);
                i++;
            }
        }
        const indexedEntries = this.#entries.map((v, i) => {
            return [v.header.prefix + v.header.name, i];
        });
        this.#indexMap = new Map(indexedEntries);
    }
    toBlob() {
        const parts = [];
        for (const entry of this.#entries) {
            const headerBlock = new Uint8Array(BLOCK_SIZE);
            writeHeader(entry.header, headerBlock);
            parts.push(headerBlock);
            if (entry.content) {
                parts.push(entry.content);
                let overflow = entry.content.size % BLOCK_SIZE;
                if (overflow > 0) {
                    const paddingSize = BLOCK_SIZE - overflow;
                    const padding = new ArrayBuffer(paddingSize);
                    parts.push(padding);
                }
            }
        }
        const endOfArchive = new ArrayBuffer(2 * BLOCK_SIZE);
        parts.push(endOfArchive);
        return new Blob(parts, {
            endings: "transparent",
            type: "application/x-tar"
        });
    }
}
function normalizePath(path) {
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
function splitFilename(path) {
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
function tarHeader(name, mode, uid, gid, size, lastModified, checksum, typeflag, linkname, version, uname, gname, devmajor, devminor, prefix) {
    lastModified = Math.floor(lastModified / 1000);
    if (lastModified > MAX_TIMESTAMP) {
        lastModified = MAX_TIMESTAMP;
    }
    const header = {
        name, mode, uid, gid, size, lastModified, checksum: checksum ?? 0,
        typeflag, linkname, version, uname, gname, devmajor, devminor,
        prefix
    };
    if (checksum === undefined) {
        const bytes = new Uint8Array(500);
        writeHeader(header, bytes);
        const precision = 7 * 3;
        header.checksum = generateChecksum(bytes, precision);
    }
    return header;
}
function writeHeader(header, output, offset = 0) {
    output = output.subarray(offset, offset + 500);
    writeString(header.name, output, 0x000, 100);
    writeOctal(header.mode, output, 0x064, 8);
    writeOctal(header.uid, output, 0x06c, 8);
    writeOctal(header.gid, output, 0x074, 8);
    writeOctal(header.size, output, 0x07c, 12);
    writeOctal(header.lastModified, output, 0x088, 12);
    writeOctal(header.checksum, output, 0x094, 7);
    output[0x9b] = 0x20;
    writeOctal(header.typeflag, output, 0x09c, 1);
    writeString(header.linkname, output, 0x09d, 100);
    writeString("ustar", output, 0x101, 6);
    writeOctal(header.version & 0o77, output, 0x107, 3);
    writeString(header.uname, output, 0x109, 32);
    writeString(header.gname, output, 0x129, 32);
    if (header.devmajor === undefined) {
        output.fill(0x00, 0x149, 0x149 + 8);
    }
    else {
        writeOctal(header.devmajor, output, 0x149, 8);
    }
    if (header.devminor === undefined) {
        output.fill(0x00, 0x151, 0x151 + 8);
    }
    else {
        writeOctal(header.devminor, output, 0x151, 8);
    }
    writeString(header.prefix, output, 0x159, 155);
}
function writeString(value, output, offset = 0, length = output.length - offset) {
    output = output.subarray(offset, offset + length);
    const written = new TextEncoder().encodeInto(value, output).written;
    if (written < length) {
        output[written] = 0x00;
    }
}
function writeOctal(value, output, offset = 0, length = output.length - offset) {
    const octalLength = Math.max(1, Math.ceil(Math.log2(value) / 3));
    if (octalLength < length) {
        length--;
        output[offset + length] = 0x00;
    }
    for (let i = offset + length - 1; i >= offset; i--) {
        const charcode = 0x30 + (value & 7);
        value >>= 3;
        output[i] = charcode;
    }
}
function generateChecksum(bytes, precision) {
    const mask = (2 << precision) - 1;
    const chksumStart = 0x094;
    const chksumEnd = 0x09b;
    let value = 0;
    for (let i = 0; i < bytes.length; i++) {
        let byte = bytes[i];
        if (chksumStart <= i && i <= chksumEnd) {
            byte = 0x20;
        }
        value = (value + byte) & mask;
    }
    return value;
}
function decodeString(bytes, offset = 0, length = bytes.length - offset) {
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
function decodeOctal(bytes, offset, length) {
    bytes = new Uint8Array(bytes, offset, length);
    let value = 0;
    for (const byte of bytes) {
        if (byte === 0) {
            break;
        }
        value <<= 3;
        if (byte < 0x31 || 0x37 < byte) {
            continue;
        }
        value |= byte - 0x30;
    }
    return value;
}
function isZeroed(bytes) {
    return bytes.every(v => v === 0);
}
//# sourceMappingURL=esmodule.js.map