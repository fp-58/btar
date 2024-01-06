#!/bin/sh

# Run this script from the root of the repository
# Example: ./scripts/compile.sh


# Generate index.js and definitions without comments
npx tsc --removeComments

# Generate definition files with comments
npx tsc --emitDeclarationOnly

# Rename compiled files (for backwards compatibility with v1.0.0)
mv lib/index.js lib/esmodule.js
