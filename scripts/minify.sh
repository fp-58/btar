#!/bin/sh

# Run this script from the root of the repository
# Example: ./scripts/minify.bat

npx terser lib/index.js --config-file terser.json -o lib/index.min.js
