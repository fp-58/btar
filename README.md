# btar

## Description
A basic for library creating and reading USTar files in the browser.

## Installing

### Installing the latest commit
```sh
npm install fp-58/btar
```

### Installing a specific version
```sh
npm install fp-58/btar#VERSION
```
Replace `VERSION` with the version tag.

## Importing

### CommonJS
```js
const btar = require("btar");
```

### AMD
```js
define(["btar"], function (btar) {
    // Do something here
})
```

### AMD (Simplified CommonJS Wrapping)
```js
define(function (require) {
    const btar = require("btar");
})
```

### HTML Script Tag
```html
<script src="<uri-to-btar>/lib/index.js"></script>
```
The script declares a global variable named `btar`.

## Usage

### Reading an archive
```js
const archive = await btar.TarArchive.fromFile(file);
```

### Extracting files from an archive
```js
const FILE_TYPEFLAG = 0;

// Map of paths to files
let files = new Map();
for (const entry of archive) {
    const fullpath = entry.header.prefix + entry.header.name;
    if (entry.header.typeflag === FILE_TYPEFLAG) {
        files.set(fullpath, entry.content);
    }
}
```

### Adding files to an archive
```js
const file = new File(["Hello, world!"], "text.txt", {
    lastModified: Date.now()
});

archive.addFile("text.txt", file);
```
