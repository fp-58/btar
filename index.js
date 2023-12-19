(() => {
    class TarArchive {
        /**
         * A map of file paths to entry indicies.
         * @type {Map<string, number>}
         */
        #indexMap = new Map();
        /** @type {import("./types").TarEntry[]} */
        #entries = [];

        /**
         * 
         * @param {string} path
         * @param {File} file
         * @param {import("./types").TarFileOptions} [options]
         */
        addFile(path, file, options) {
            if (path.endsWith("/")) {
                path = path.substring(0, path.length - 1);
            }

            const sepIndex = path.lastIndexOf("/");

            const header = tarHeader(
                path.substring(sepIndex + 1),
                options?.mode ?? 0o644,
                options?.uid ?? 0,
                options?.gid ?? 0,
                file.size,
                file.lastModified,
                -1,
                0,
                "",
                0,
                options?.uname ?? "",
                options?.gname ?? "",
                0,
                0,
                path.substring(0, sepIndex + 1)
            );

            this.#indexMap.set(path, this.#entries.length);
            this.#entries.push({ header, content: file });
        }

        /**
         * @param {File} file
         */
        static async fromFile(file) {
            const blockSize = 512;
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
                let entryName;
                if (fullpath.endsWith("/")) {
                    let trimmedPath = fullpath.substring(0, fullpath.length - 1);
                    let sepIndex = trimmedPath.lastIndexOf("/");
                    entryName = trimmedPath.substring(sepIndex);
                }
                else {
                    let sepIndex = fullpath.lastIndexOf("/");
                    entryName = fullpath.substring(sepIndex);
                }

                const content = new ArchivedFile([file.slice(start, end)], entryName, fullpath, {
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
                    return new Uint8Array(512);
                }
                else if (file.size < end) {
                    const block = new Uint8Array(512);
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
                if (file.size - blockIndex * blockSize > -512) {
                    blockIndex++;
                }
                return block;
            }
        }
    }

    /**
     * @param {string} name
     * @param {number} mode
     * @param {number} uid
     * @param {number} gid
     * @param {number} size
     * @param {number} lastModified
     * @param {number} checksum
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

        return {
            name, mode, uid, gid, size, lastModified, checksum, typeflag,
            linkname, version, uname, gname, devmajor, devminor, prefix
        };
    }

    /** @implements {File} */
    class ArchivedFile extends File {
        #relativePath;

        /**
         * @param {BlobPart[]} fileParts
         * @param {string} name
         * @param {string} relativePath
         * @param {FilePropertyBag} options
         */
        constructor(
            fileParts, name, relativePath, options
        ) {
            super(fileParts, name, options);
            this.#relativePath = relativePath;
        }

        get webkitRelativePath() {
            return this.#relativePath;
        }
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

    // @ts-ignore
    if (typeof define === "function" && define.amd) {
        // @ts-ignore
        define(function() {
            return {
                "TarArchive": TarArchive
            }
        });
    }
    else if (typeof module === "object" && module) {
        // @ts-ignore
        module.exports["TarArchive"] = TarArchive;
    }
    else if (typeof exports === "object" && exports) {
        // @ts-ignore
        exports["TarArchive"] = TarArchive;
    }
    else if (typeof window === "object" && window) {
        // @ts-ignore
        window["TarArchive"] = TarArchive;
    }
    else {
        // @ts-ignore
        globalThis["TarArchive"] = TarArchive;
    }
})()