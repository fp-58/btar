@REM Run this script from the root of the repository
@REM Example: .\scripts\minify.bat

@call npx terser lib\index.js --config-file terser\index.json -o lib\index.min.js
@call npx terser lib\esmodule.js --config-file terser\esmodule.json -o lib\esmodule.min.js