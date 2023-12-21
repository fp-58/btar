export class TarArchive {
    static fromFile(file: File): Promise<TarArchive>;
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
    _mode?: number;
    _uid?: number;
    _gid?: number;
    _uname?: string;
    _gname?: string;
}

export interface TarFileOptions extends TarPermissionOptions {}

export interface TarDatedOptions extends TarPermissionOptions {
    _lastModified?: number;
}

export interface TarDirectoryOptions extends TarDatedOptions {}

export interface TarLinkOptions extends TarDatedOptions {}

export interface TarDeviceOptions extends TarDatedOptions {}