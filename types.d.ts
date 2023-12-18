export interface TarHeader {
    name: string;
    mode: FileMode;
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
    devmajor: number;
    devminor: number;
    prefix: string;
}

export interface FileMode {
    user: {
        read: boolean;
        write: boolean;
        execute: boolean;
    }
    group: {
        read: boolean;
        write: boolean;
        execute: boolean;
    }
    others: {
        read: boolean;
        write: boolean;
        execute: boolean;
    },
    setuid: boolean;
    setgid: boolean;
    sticky: boolean;
};