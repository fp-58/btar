@REM Run this script from the root of the repository
@REM Example: .\scripts\compile.bat


@REM Generate esmodule.js and definitions without comments
@call npx tsc --removeComments

@REM Generate definition files with comments
@call npx tsc --emitDeclarationOnly

@REM Move generated definitions
@move types\esmodule.d.ts types\index.d.ts

@REM Generate index.js using esmodule.js with rollup
@call npx rollup lib\esmodule.js -o lib\index.js -f umd -n btar -m --sourcemapExcludeSources