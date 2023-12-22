@REM Run this script from the root of the repository
@REM Example: .\scripts\minify.bat

@call npx terser index.js --config-file terser.json -o index.min.js