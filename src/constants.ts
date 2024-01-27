export const BLOCK_SIZE = 512;
export const MAX_TIMESTAMP = 68719476735;

export const enum TarEntryType {
    file = 0,
    link = 1,
    symlink = 2,
    chardev = 3,
    blockdev = 4,
    directory = 5,
    fifo = 6,
}

export const enum TarDefaults {
    filemode = 0o644,
    dirmode = 0o775,
    uid = 0,
    gid = 0,
    uname = "",
    gname = "",
}
