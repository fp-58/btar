#!/bin/sh

# Run this script from the root of the repository
# Example: ./scripts/minify.bat

npx terser lib/index.js --config-file terser/index.json -o lib/index.min.js
npx terser lib/esmodule.js --config-file terser/esmodule.json -o lib/esmodule.min.js