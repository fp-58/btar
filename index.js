(() => {
    const blockSize = 512;
    class TarArchive {
        /**
         * A map of file paths to entry indicies.
         * @type {Map<string, number>}
         */
        #indexMap = new Map();
        /** @type {import("./types").TarEntry[]} */
        #entries = [];

        /**
         * Appends a file entry to the end of the archive.
         * 
         * @param {string} path The path of the file.
         * @param {File} file The file content.
         * @param {import("./types").TarFileOptions} [options]
         */
        addFile(path, file, options) {
            path = trimPath(path);
            const filename = splitFilename(path);

            const header = tarHeader(
                filename._name,
                options?.mode ?? 0o644,
                options?.uid ?? 0,
                options?.gid ?? 0,
                file.size,
                file.lastModified,
                undefined,
                0,
                "",
                0,
                options?.uname ?? "",
                options?.gname ?? "",
                0,
                0,
                filename._prefix
            );

            this.#indexMap.set(path, this.#entries.length);
            this.#entries.push({ header, content: file });
        }

        /**
         * Appends a link with a given type.
         * @param {number} type
         * @param {string} path
         * @param {string} target
         * @param {import("./types").TarLinkOptions} [options]
         */
        #addLink(type, path, target, options) {
            path = trimPath(path);
            const filename = splitFilename(path);

            let trailingSep = target.endsWith("/");
            target = trimPath(path);
            if (trailingSep) {
                target += "/";
            }

            const header = tarHeader(
                filename._name,
                options?.mode ?? 0o644,
                options?.uid ?? 0,
                options?.gid ?? 0,
                0,
                options?.lastModified ?? Date.now(),
                undefined,
                type,
                target,
                0,
                options?.uname ?? "",
                options?.gname ?? "",
                0,
                0,
                filename._prefix
            );

            this.#indexMap.set(path, this.#entries.length);
            this.#entries.push({ header });
        }

        /**
         * Appends a hard link entry to the end of the archive.
         * 
         * @param {string} path The path of the hard link.
         * @param {string} target The target path of the hard link.
         * @param {import("./types").TarLinkOptions} [options]
         */
        addHardlink(path, target, options) {
            this.#addLink(1, path, target, options);
        }

        /**
         * Appends a symbolic link entry to the end of the archive.
         * 
         * @param {string} path The path of the symbolic link.
         * @param {string} target The target of the symbolic link.
         * @param {import("./types").TarLinkOptions} options
         */
        addSymlink(path, target, options) {
            this.#addLink(2, path, target, options);
        }

        /**
         * Appends a directory entry to the end of the archive.
         * @param {string} path The path of the directory.
         * @param {import("./types").TarDirectoryOptions} [options]
         */
        addDir(path, options) {
            path = trimPath(path) + "/";
            const filename = splitFilename(path);

            const header = tarHeader(
                filename._name,
                options?.mode ?? 0o775,
                options?.uid ?? 0,
                options?.gid ?? 0,
                0,
                options?.lastModified ?? Date.now(),
                undefined,
                5,
                "",
                0,
                options?.uname ?? "",
                options?.gname ?? "",
                0,
                0,
                filename._prefix
            );

            this.#indexMap.set(path, this.#entries.length);
            this.#entries.push({ header });
        }

        /**
         * 
         * @param {number} type
         * @param {string} path
         * @param {number} majorId
         * @param {number} minorId
         * @param {import("./types").TarDeviceOptions} [options]
         */
        #addDevice(type, path, majorId, minorId, options) {
            path = trimPath(path);
            const filename = splitFilename(path);

            const header = tarHeader(
                filename._name,
                options?.mode ?? 0o644,
                options?.uid ?? 0,
                options?.gid ?? 0,
                0,
                options?.lastModified ?? Date.now(),
                undefined,
                type,
                "",
                0,
                options?.uname ?? "",
                options?.gname ?? "",
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
         * @param {import("./types").TarDeviceOptions} [options]
         */
        addCharDevice(path, majorId, minorId, options) {
            this.#addDevice(3, path, majorId, minorId, options)
        }

        /**
         * Appends a block device entry to the end of the archive.
         * 
         * @param {string} path The path of the block device.
         * @param {number} majorId The major component of the device ID.
         * @param {number} minorId The minor component of the device ID.
         * @param {import("./types").TarDeviceOptions} [options]
         */
        addBlockDevice(path, majorId, minorId, options) {
            this.#addDevice(4, path, majorId, minorId, options);
        }

        get length() {
            return this.#entries.length;
        }

        /**
         * Returns the archived entry at a given index.
         * @param {number} index The index of the entry.
         * @returns {import("./types").TarEntry | undefined}
         */
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

        /**
         * Returns the index of an archived entry. Returns `-1` if the path is
         * not archived.
         * @param {string} path
         * @returns {number}
         */
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

        /**
         * @param {File} file
         */
        static async fromFile(file) {
            let blockIndex = 0;
            
            const result = new TarArchive();

            for (
                let header = await readHeader(); header;
                header = await readHeader()
            ) {
                let start = blockIndex * blockSize;
                let end = start + header.size;
                if (file.size < end) {
                    throw new Error(`Malformed archive: Expected size ${end}, got size ${file.size}`);
                }

                let fullpath = header.prefix + header.name;

                const content = new File([file.slice(start, end)], fullpath, {
                    lastModified: header.lastModified,
                    endings: "transparent"
                });

                result.#indexMap.set(fullpath, result.#entries.length);

                result.#entries.push({ header, content });
                blockIndex += Math.ceil(header.size / blockSize);
            }

            /**
             * Reads the next block as a header.
             * @returns {Promise<import("./types").TarHeader | null>}
             */
            async function readHeader() {
                const headerBlock = await nextBlock();
                if (isZeroed(headerBlock)) {
                    const nextHeaderBlock = await peekBlock();
                    if (isZeroed(nextHeaderBlock)) {
                        return null;
                    }
                }

                return tarHeader(
                    decodeString(headerBlock, 0x000, 100),  // name
                    decodeOctal (headerBlock, 0x064, 8),    // mode
                    decodeOctal (headerBlock, 0x06c, 8),    // uid
                    decodeOctal (headerBlock, 0x074, 8),    // gid
                    decodeOctal (headerBlock, 0x07c, 12),   // size
                    decodeOctal (headerBlock, 0x088, 12),   // lastModified
                    decodeOctal (headerBlock, 0x094, 8),    // checksum
                    decodeOctal (headerBlock, 0x09c, 1),    // typeflag
                    decodeString(headerBlock, 0x09d, 100),  // linkname
                    decodeOctal (headerBlock, 0x107, 3),    // version
                    decodeString(headerBlock, 0x109, 32),   // uname
                    decodeString(headerBlock, 0x129, 32),   // gname
                    decodeOctal (headerBlock, 0x149, 8),    // devmajor
                    decodeOctal (headerBlock, 0x151, 8),    // devminor
                    decodeString(headerBlock, 0x159, 155)   // prefix
                );
            }

            async function peekBlock() {
                let start = blockIndex * blockIndex;
                let end = start + blockSize;
                if (file.size < start) {
                    return new Uint8Array(blockSize);
                }
                else if (file.size < end) {
                    const block = new Uint8Array(blockSize);
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
                if (file.size - blockIndex * blockSize > -blockSize) {
                    blockIndex++;
                }
                return block;
            }
        }

        /** Removes duplicate entries from the archive. */
        trim() {
            /** @type {Set<string>} */
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
            
            /** @type {[string, number][]} */
            const indexedEntries = this.#entries.map((v, i) => {
                return [v.header.prefix + v.header.name, i];
            });

            this.#indexMap = new Map(indexedEntries);
        }

        /** Returns the binary representation of the archive as a `Blob` */
        toBlob() {
            /** @type {BlobPart[]} */
            const parts = [];

            for (const entry of this.#entries) {
                const headerBlock = new Uint8Array(blockSize);
                writeHeader(entry.header, headerBlock);
                parts.push(headerBlock);

                if (entry.content) {
                    parts.push(entry.content);

                    let overflow = entry.content.size % blockSize;
                    if (overflow > 0) {
                        const paddingSize = blockSize - overflow;
                        const padding = new ArrayBuffer(paddingSize);
                        parts.push(padding);
                    }
                }
            }

            const endOfArchive = new ArrayBuffer(2 * blockSize);
            parts.push(endOfArchive);

            return new Blob(parts, {
                endings: "transparent",
                type: "application/x-tar"
            });
        }
    }

    /**
     * Removes the leading and trailing '/' from a path.
     * @param {string} path
     */
    function trimPath(path) {
        let start = 0;
        while (path[start] === "/") {
            start++;
        }
        
        let end = path.length;
        while (end > start && path[end - 1] === "/") {
            end--;
        }

        return path.substring(start, end);
    }

    /**
     * 
     * @param {string} path
     */
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

    /**
     * @param {string} name
     * @param {number} mode
     * @param {number} uid
     * @param {number} gid
     * @param {number} size
     * @param {number} lastModified
     * @param {number | undefined} checksum
     * @param {number} typeflag
     * @param {string} linkname
     * @param {number} version
     * @param {string} uname
     * @param {string} gname
     * @param {number} devmajor
     * @param {number} devminor
     * @param {string} prefix
     * @returns {import("./types").TarHeader}
     */
    function tarHeader(
        name, mode, uid, gid, size, lastModified, checksum, typeflag, linkname,
        version, uname, gname, devmajor, devminor, prefix
    ) {
        const header = {
            name, mode, uid, gid, size, lastModified, checksum: checksum ?? 0,
            typeflag, linkname, version, uname, gname, devmajor, devminor,
            prefix
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

    /**
     * @param {import("./types").TarHeader} header
     * @param {Uint8Array} output
     * @param {number} [offset]
     */
    function writeHeader(header, output, offset = 0) {
        output = output.subarray(offset, offset + 500);
        writeString     (header.name,           output, 0x000, 100);
        writeOctal      (header.mode,           output, 0x064, 8);
        writeOctal      (header.uid,            output, 0x06c, 8);
        writeOctal      (header.gid,            output, 0x074, 8);
        writeOctal      (header.size,           output, 0x07c, 12);
        writeOctal      (header.lastModified,   output, 0x088, 12);
        writeOctal      (header.checksum,       output, 0x094, 8);
        writeOctal      (header.typeflag,       output, 0x09c, 1);
        writeString     (header.linkname,       output, 0x09d, 100);
        writeString     ("ustar",               output, 0x101, 6);
        writeOctal      (header.version & 0o77, output, 0x107, 3);
        writeString     (header.uname,          output, 0x109, 32);
        writeString     (header.gname,          output, 0x129, 32);
        if (header.devmajor === undefined) {
            output.fill(0x00, 0x149, 0x149 + 8);
        }
        else {
            writeOctal  (header.devmajor,       output, 0x149, 8);
        }
        if (header.devminor === undefined) {
            output.fill(0x00, 0x151, 0x151 + 8);
        }
        else {
            writeOctal  (header.devminor,       output, 0x151, 8);
        }
        writeString     (header.prefix,         output, 0x159, 155);
    }

    /**
     * Writes a null-terminated string to a Uint8Array.
     * @param {string} value
     * @param {Uint8Array} output
     * @param {number} [offset]
     * @param {number} [length]
     */
    function writeString(value, output, offset = 0, length = output.length - offset) {
        output = output.subarray(offset, offset + length);
        const written = new TextEncoder().encodeInto(value, output).written;
        if (written < length) {
            output[written] = 0x00;
        }
    }

    /**
     * Writes a null-terminated octal string to a Uint8Array.
     * @param {number} value
     * @param {Uint8Array} output
     * @param {number} [offset]
     * @param {number} [length]
     */
    function writeOctal(value, output, offset = 0, length = output.length - offset) {
        const octalLength = Math.ceil(Math.log2(value) / 3);

        if (octalLength < length) {
            length--;
            output[offset + length] = 0x00;
        }

        for (let i = length - 1; i >= offset; i--) {
            const charcode = 0x30 + (value & 7);
            value >>= 3;
            output[i] = charcode;
        }
    }

    /**
     * Generate a checksum of an array of bytes with a given precision.
     * @param {Uint8Array} bytes
     * @param {number} precision
     */
    function generateChecksum(bytes, precision) {
        const mask = (2 << precision) - 1;
        const chksumStart = 0x094;
        const chksumEnd =   0x09c;

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

    /**
     * Decodes a null-terminated string from an array of bytes.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} length
     */
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

    /**
     * Parses a null-terminated octal string from an array of bytes.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} length
     */
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

    /**
     * Returns whether or not all bytes are zero.
     * @param {Uint8Array} bytes
     */
    function isZeroed(bytes) {
        return bytes.every(v => v === 0);
    }

    const _exports = { TarArchive };

    // @ts-ignore
    if (typeof define === "function" && define.amd) {
        // @ts-ignore
        define(function() {
            return _exports;
        });
    }
    else if (typeof module === "object" && module) {
        module.exports = _exports;
    }
    else if (typeof exports === "object" && exports) {
        exports.TarArchive = TarArchive;
    }
    else if (typeof window === "object" && window) {
        // @ts-ignore
        window.btar = _exports;
    }
    else {
        // @ts-ignore
        globalThis.btar = _exports;
    }
})()