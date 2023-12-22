const isMin = import.meta.url.endsWith(".min.js");
let importPath = "./index";
if (isMin) {
    importPath += ".min";
}
importPath += ".js";

/** @type {import("../types")} */
const btar = await new Promise(async (resolve) => {
    const _define = {
        existed: "define" in window,
        // @ts-ignore
        value: window.define
    };

    /** @param {() => import("../types")} factory */
    function define(factory) {
        resolve(factory());
    }
    define["amd"] = true;

    // @ts-ignore
    window.define = define;

    await import(importPath);

    // @ts-ignore
    window.define = _define.value;
    if (!_define.existed) {
        // @ts-ignore
        delete window.define;
    }
});

const { TarArchive } = btar;
export { TarArchive };
