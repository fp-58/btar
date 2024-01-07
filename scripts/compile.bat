@REM Run this script from the root of the repository
@REM Example: .\scripts\compile.sh


@REM Generate index.js and definitions without comments
@call npx tsc --removeComments

@REM Generate definition files with comments
@call npx tsc --emitDeclarationOnly

@REM Rename compiled files (for backwards compatibility with v1.0.0)
@move lib\index.js lib\esmodule.js

@REM Generate index.js using esmodule.js with rollup
@call npx rollup lib\esmodule.js -o lib\index.js -f umd -n btar