#!/bin/sh

# Run this script from the root of the repository
# Example: ./scripts/compile.sh


# Generate esmodule.js and definitions without comments
npx tsc --removeComments

# Generate definition files with comments
npx tsc --emitDeclarationOnly

# Move generated definitions
mv types/esmodule.d.ts types/index.d.ts

# Generate index.js using esmodule.js with rollup
npx rollup lib/esmodule.js -o lib/index.js -f umd -n btar -m --sourcemapExcludeSources
