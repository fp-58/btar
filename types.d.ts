export { TarArchive } from "./index";

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