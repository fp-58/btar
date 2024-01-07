export declare class TarArchive implements Iterable<TarEntry> {
    #private;
    /**
     * Appends a file entry to the end of the archive.
     *
     * @param path The path of the file.
     * @param file The file content.
     */
    addFile(path: string, file: File, options?: TarFileOptions): void;
    /**
     * Appends a hard link entry to the end of the archive.
     *
     * @param path The path of the hard link.
     * @param target The target path of the hard link.
     */
    addHardlink(path: string, target: string, options?: TarLinkOptions): void;
    /**
     * Appends a symbolic link entry to the end of the archive.
     *
     * @param path The path of the symbolic link.
     * @param target The target of the symbolic link.
     */
    addSymlink(path: string, target: string, options?: TarLinkOptions): void;
    /**
     * Appends a directory entry to the end of the archive.
     *
     * @param path The path of the directory.
     */
    addDir(path: string, options?: TarDirectoryOptions): void;
    /**
     * Appends a character device entry to the end of the archive.
     *
     * @param {string} path The path of the character device.
     * @param {number} majorId The major component of the device ID.
     * @param {number} minorId The minor component of the device ID.
     */
    addCharDevice(path: string, majorId: number, minorId: number, options?: TarDeviceOptions): void;
    /**
     * Appends a block device entry to the end of the archive.
     *
     * @param {string} path The path of the block device.
     * @param {number} majorId The major component of the device ID.
     * @param {number} minorId The minor component of the device ID.
     */
    addBlockDevice(path: string, majorId: number, minorId: number, options?: TarDeviceOptions): void;
    /**
     * Appends an FIFO (named pipe) entry to the end of the archive.
     *
     * @param path The path of the FIFO.
     */
    addFIFO(path: string, options?: TarFIFOOptions): void;
    get length(): number;
    [Symbol.iterator](): IterableIterator<TarEntry>;
    /** Returns an iterable of archived entries. */
    entries(): IterableIterator<TarEntry>;
    /**
     * Returns the archived entry at a given index.
     *
     * @param index The index of the entry.
     */
    entryAt(index: number): TarEntry | undefined;
    /**
     * Returns the index of an archived entry. Returns `-1` if the path is not
     * archived.
     */
    indexOf(path: string): number;
    /** Removes an entry from the archive by index. */
    removeAt(index: number): void;
    /**
     * Removes an entry from the archive by path.
     *
     * @param path The path of the entry to remove.
     */
    removeEntry(path: string): void;
    /** Reads a tar archive from a `Blob`. */
    static fromBlob(file: Blob): Promise<TarArchive>;
    /** Removes duplicate entries from the archive. */
    trim(): void;
    /** Returns the binary representation of the archive as a `Blob` */
    toBlob(): Blob;
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
export interface TarFileOptions extends TarPermissionOptions {
}
export interface TarDatedOptions extends TarPermissionOptions {
    lastModified?: number;
}
export interface TarDirectoryOptions extends TarDatedOptions {
}
export interface TarLinkOptions extends TarDatedOptions {
}
export interface TarDeviceOptions extends TarDatedOptions {
}
export interface TarFIFOOptions extends TarDatedOptions {
}
