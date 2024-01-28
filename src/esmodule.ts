import {
    BLOCK_SIZE,
    MAX_TIMESTAMP,
    TarDefaults,
    TarEntryType,
} from "./constants.js";
import { decodeString, decodeOctal, writeString, writeOctal } from "./io.js";
import { generateChecksum } from "./utils.js";
import { normalizePath, splitFilename, isZeroed } from "./utils.js";

export class TarArchive implements Iterable<TarEntry> {
    /** A map of file paths to entry indicies. */
    #indexMap = new Map<string, number>();
    #entries: TarEntry[] = [];

    /**
     * Appends a file entry to the end of the archive.
     *
     * @param path The path of the file.
     * @param file The file content.
     */
    addFile(path: string, file: File, options?: TarFileOptions): void {
        path = normalizePath(path);
        const filename = splitFilename(path);

        const header = tarHeader(
            filename._name,
            options?.mode ?? TarDefaults.filemode,
            options?.uid ?? TarDefaults.uid,
            options?.gid ?? TarDefaults.gid,
            file.size,
            file.lastModified,
            undefined,
            TarEntryType.file,
            "",
            0,
            options?.uname ?? TarDefaults.uname,
            options?.gname ?? TarDefaults.gname,
            undefined,
            undefined,
            filename._prefix
        );

        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header, content: file });
    }

    /** Appends a link with a given type. */
    #addLink(
        type: TarEntryType.link | TarEntryType.symlink,
        path: string,
        target: string,
        options?: TarLinkOptions
    ): void {
        path = normalizePath(path);
        const filename = splitFilename(path);

        let trailingSep = target.endsWith("/");
        target = normalizePath(path);
        if (trailingSep) {
            target += "/";
        }

        const header = tarHeader(
            filename._name,
            options?.mode ?? TarDefaults.filemode,
            options?.uid ?? TarDefaults.uid,
            options?.gid ?? TarDefaults.gid,
            0,
            options?.lastModified ?? Date.now(),
            undefined,
            type,
            target,
            0,
            options?.uname ?? TarDefaults.uname,
            options?.gname ?? TarDefaults.gname,
            undefined,
            undefined,
            filename._prefix
        );

        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }

    /**
     * Appends a hard link entry to the end of the archive.
     *
     * @param path The path of the hard link.
     * @param target The target path of the hard link.
     */
    addHardlink(path: string, target: string, options?: TarLinkOptions): void {
        this.#addLink(TarEntryType.link, path, target, options);
    }

    /**
     * Appends a symbolic link entry to the end of the archive.
     *
     * @param path The path of the symbolic link.
     * @param target The target of the symbolic link.
     */
    addSymlink(path: string, target: string, options?: TarLinkOptions): void {
        this.#addLink(TarEntryType.symlink, path, target, options);
    }

    /**
     * Appends a directory entry to the end of the archive.
     *
     * @param path The path of the directory.
     */
    addDir(path: string, options?: TarDirectoryOptions) {
        path = normalizePath(path) + "/";
        const filename = splitFilename(path);

        const header = tarHeader(
            filename._name,
            options?.mode ?? TarDefaults.dirmode,
            options?.uid ?? TarDefaults.uid,
            options?.gid ?? TarDefaults.gid,
            0,
            options?.lastModified ?? Date.now(),
            undefined,
            TarEntryType.directory,
            "",
            0,
            options?.uname ?? TarDefaults.uname,
            options?.gname ?? TarDefaults.gname,
            undefined,
            undefined,
            filename._prefix
        );

        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }

    /** Appends a device entry to the end of the archive. */
    #addDevice(
        type: TarEntryType.chardev | TarEntryType.blockdev,
        path: string,
        majorId: number,
        minorId: number,
        options?: TarDeviceOptions
    ): void {
        path = normalizePath(path);
        const filename = splitFilename(path);

        const header = tarHeader(
            filename._name,
            options?.mode ?? TarDefaults.filemode,
            options?.uid ?? TarDefaults.uid,
            options?.gid ?? TarDefaults.gid,
            0,
            options?.lastModified ?? Date.now(),
            undefined,
            type,
            "",
            0,
            options?.uname ?? TarDefaults.uname,
            options?.gname ?? TarDefaults.gname,
            majorId,
            minorId,
            filename._prefix
        );

        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }

    /**
     * Appends a character device entry to the end of the archive.
     *
     * @param {string} path The path of the character device.
     * @param {number} majorId The major component of the device ID.
     * @param {number} minorId The minor component of the device ID.
     */
    addCharDevice(
        path: string,
        majorId: number,
        minorId: number,
        options?: TarDeviceOptions
    ): void {
        this.#addDevice(TarEntryType.chardev, path, majorId, minorId, options);
    }

    /**
     * Appends a block device entry to the end of the archive.
     *
     * @param {string} path The path of the block device.
     * @param {number} majorId The major component of the device ID.
     * @param {number} minorId The minor component of the device ID.
     */
    addBlockDevice(
        path: string,
        majorId: number,
        minorId: number,
        options?: TarDeviceOptions
    ): void {
        this.#addDevice(TarEntryType.blockdev, path, majorId, minorId, options);
    }

    /**
     * Appends an FIFO (named pipe) entry to the end of the archive.
     *
     * @param path The path of the FIFO.
     */
    addFIFO(path: string, options?: TarFIFOOptions) {
        path = normalizePath(path);
        const filename = splitFilename(path);

        const header = tarHeader(
            filename._name,
            options?.mode ?? TarDefaults.filemode,
            options?.uid ?? TarDefaults.uid,
            options?.gid ?? TarDefaults.gid,
            0,
            options?.lastModified ?? Date.now(),
            undefined,
            TarEntryType.fifo,
            "",
            0,
            options?.uname ?? TarDefaults.uname,
            options?.gname ?? TarDefaults.gname,
            undefined,
            undefined,
            filename._prefix
        );

        this.#indexMap.set(path, this.#entries.length);
        this.#entries.push({ header });
    }

    get length() {
        return this.#entries.length;
    }

    [Symbol.iterator]() {
        return this.entries();
    }

    /** Returns an iterable of archived entries. */
    *entries(): IterableIterator<TarEntry> {
        for (let i = 0; i < this.#entries.length; i++) {
            // @ts-ignore
            yield this.entryAt(i);
        }
    }

    /**
     * Returns the archived entry at a given index.
     *
     * @param index The index of the entry.
     */
    entryAt(index: number): TarEntry | undefined {
        const entry = this.#entries[index];
        if (!entry) {
            return undefined;
        }

        const header = Object.assign({}, entry.header);
        if (entry.content) {
            return { header, content: entry.content };
        } else {
            return { header };
        }
    }

    /**
     * Returns the index of an archived entry. Returns `-1` if the path is not
     * archived.
     */
    indexOf(path: string): number {
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
        } else {
            return mappedIndex;
        }
    }

    /** Removes an entry from the archive by index. */
    removeAt(index: number): void {
        if (index < 0 || this.#entries.length <= index) {
            return;
        }

        this.#entries.splice(index, 1);
        for (const [path, i] of this.#indexMap) {
            if (i < index) continue;

            this.#indexMap.set(path, i - 1);
        }
    }

    /**
     * Removes an entry from the archive by path.
     *
     * @param path The path of the entry to remove.
     */
    removeEntry(path: string): void {
        for (
            let i = this.#indexMap.get(path) ?? this.#entries.length - 1;
            i >= 0;
            i--
        ) {
            const entry = this.#entries[i];
            const fullpath = entry.header.prefix + entry.header.name;

            if (fullpath === path) {
                this.removeAt(i);
            }
        }
    }

    /** Reads a tar archive from a `Blob`. */
    static async fromBlob(file: Blob): Promise<TarArchive> {
        let blockIndex = 0;

        const result = new TarArchive();

        for (
            let header = await readHeader();
            header;
            header = await readHeader()
        ) {
            let start = blockIndex * BLOCK_SIZE;
            let end = start + header.size;
            if (file.size < end) {
                throw new Error(
                    `Malformed archive: Expected size ${end}, got size ${file.size}`
                );
            }
            if (
                header.typeflag !== TarEntryType.chardev &&
                header.typeflag !== TarEntryType.blockdev
            ) {
                header.devmajor = header.devminor = undefined;
            }

            let fullpath = header.prefix + header.name;

            const content = new File([file.slice(start, end)], fullpath, {
                lastModified: header.lastModified,
                endings: "transparent",
            });

            result.#indexMap.set(fullpath, result.#entries.length);

            result.#entries.push({ header, content });
            blockIndex += Math.ceil(header.size / BLOCK_SIZE);
        }

        return result;

        /** Reads the next block as a header. */
        async function readHeader(): Promise<TarHeader | null> {
            const headerBlock = await nextBlock();
            if (isZeroed(headerBlock)) {
                const nextHeaderBlock = await peekBlock();
                if (isZeroed(nextHeaderBlock)) {
                    return null;
                }
            }

            return tarHeader(
                decodeString(headerBlock, 0x000, 100), // name
                decodeOctal(headerBlock, 0x064, 8), // mode
                decodeOctal(headerBlock, 0x06c, 8), // uid
                decodeOctal(headerBlock, 0x074, 8), // gid
                decodeOctal(headerBlock, 0x07c, 12), // size
                decodeOctal(headerBlock, 0x088, 12), // lastModified
                decodeOctal(headerBlock, 0x094, 8), // checksum
                decodeOctal(headerBlock, 0x09c, 1), // typeflag
                decodeString(headerBlock, 0x09d, 100), // linkname
                decodeOctal(headerBlock, 0x107, 3), // version
                decodeString(headerBlock, 0x109, 32), // uname
                decodeString(headerBlock, 0x129, 32), // gname
                decodeOctal(headerBlock, 0x149, 8), // devmajor
                decodeOctal(headerBlock, 0x151, 8), // devminor
                decodeString(headerBlock, 0x159, 155) // prefix
            );
        }

        async function peekBlock(): Promise<Uint8Array> {
            let start = blockIndex * blockIndex;
            let end = start + BLOCK_SIZE;
            if (file.size < start) {
                return new Uint8Array(BLOCK_SIZE);
            } else if (file.size < end) {
                const block = new Uint8Array(BLOCK_SIZE);
                const slice = file.slice(start);
                const data = new Uint8Array(await slice.arrayBuffer());
                block.set(data);
                return block;
            } else {
                const slice = file.slice(start, end);
                return new Uint8Array(await slice.arrayBuffer());
            }
        }

        async function nextBlock(): Promise<Uint8Array> {
            const block = await peekBlock();
            if (file.size - blockIndex * BLOCK_SIZE > -BLOCK_SIZE) {
                blockIndex++;
            }
            return block;
        }
    }

    /** Removes duplicate entries from the archive. */
    trim() {
        let entrySet = new Set<string>();

        for (let i = this.#entries.length - 1; i >= 0; i--) {
            const entry = this.#entries[i];
            const path = entry.header.prefix + entry.header.name;

            if (!entrySet.has(path)) {
                entrySet.add(path);
            } else {
                this.#entries.splice(i, 1);
                i++;
            }
        }

        const indexedEntries: [string, number][] = this.#entries.map((v, i) => {
            return [v.header.prefix + v.header.name, i];
        });

        this.#indexMap = new Map(indexedEntries);
    }

    /** Returns the binary representation of the archive as a `Blob` */
    toBlob(): Blob {
        const parts: BlobPart[] = [];

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
            type: "application/x-tar",
        });
    }
}

function tarHeader(
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

function writeHeader(
    header: TarHeader,
    output: Uint8Array,
    offset: number = 0
): void {
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
    } else {
        writeOctal(header.devmajor, output, 0x149, 8);
    }
    if (header.devminor === undefined) {
        output.fill(0x00, 0x151, 0x151 + 8);
    } else {
        writeOctal(header.devminor, output, 0x151, 8);
    }
    writeString(header.prefix, output, 0x159, 155);
}

export interface TarEntry {
    header: TarHeader;
    content?: File;
}

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

export interface TarPermissionOptions {
    mode?: number;
    uid?: number;
    gid?: number;
    uname?: string;
    gname?: string;
}

export interface TarFileOptions extends TarPermissionOptions {}

export interface TarDatedOptions extends TarPermissionOptions {
    lastModified?: number;
}

export interface TarDirectoryOptions extends TarDatedOptions {}

export interface TarLinkOptions extends TarDatedOptions {}

export interface TarDeviceOptions extends TarDatedOptions {}

export interface TarFIFOOptions extends TarDatedOptions {}
