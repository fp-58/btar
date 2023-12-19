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

                return {
                    name:           decodeString(headerBlock, 0x000, 100),
                    mode:           decodeOctal (headerBlock, 0x064, 8),
                    uid:            decodeOctal (headerBlock, 0x06c, 8),
                    gid:            decodeOctal (headerBlock, 0x074, 8),
                    size:           decodeOctal (headerBlock, 0x07c, 12),
                    lastModified:   decodeOctal (headerBlock, 0x088, 12),
                    checksum:       decodeOctal (headerBlock, 0x094, 8),
                    typeflag:       decodeOctal (headerBlock, 0x09c, 1),
                    linkname:       decodeString(headerBlock, 0x09d, 100),
                    version:        decodeOctal (headerBlock, 0x107, 3),
                    uname:          decodeString(headerBlock, 0x109, 32),
                    gname:          decodeString(headerBlock, 0x129, 32),
                    devmajor:       decodeOctal (headerBlock, 0x149, 8),
                    devminor:       decodeOctal (headerBlock, 0x151, 8),
                    prefix:         decodeString(headerBlock, 0x159, 155)
                };
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
                TarArchive
            }
        });
    }
    else if (typeof module === "object" && module) {
        // @ts-ignore
        module.exports = { TarArchive };
    }
    else if (typeof exports === "object" && exports) {
        // @ts-ignore
        exports.TarArchive = TarArchive;
    }
    else if (typeof window === "object" && window) {
        // @ts-ignore
        window.TarArchive = TarArchive;
    }
    else {
        // @ts-ignore
        globalThis.TarArchive = TarArchive;
    }
})()