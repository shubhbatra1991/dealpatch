/* eslint-disable @typescript-eslint/no-require-imports -- Webpack's CommonJS loader loads the installed TypeScript compiler. */
const ts = require("typescript");
module.exports = function (source) {
  return ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, resolveJsonModule: true,
  }, fileName: this.resourcePath }).outputText;
};
