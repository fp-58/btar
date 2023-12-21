@REM Run this script from the root of the repository
@REM Example: .\scripts\minify.bat

@call npx terser lib\index.js --config-file terser.json -o lib\index.min.js