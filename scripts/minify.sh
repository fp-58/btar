#!/bin/sh

# Run this script from the root of the repository
# Example: ./scripts/minify.bat

npx terser index.js --config-file terser.json -o index.min.js
