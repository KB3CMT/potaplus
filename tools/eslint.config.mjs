import globals from "globals";
export default [{ files:["work/**/*.js"], ignores:["work/include/lz-string.min.js"],
  languageOptions:{ ecmaVersion:2022, sourceType:"script", globals:{...globals.browser, ...globals.webextensions, LZString:"readonly"}},
  rules:{ "no-undef":"warn", "no-unused-vars":"off", "no-redeclare":"off", "no-dupe-keys":"error", "no-unreachable":"warn", "no-const-assign":"error"}}];
