module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  settings: { react: { version: "18.2" } },
  plugins: ["react-refresh"],
  rules: {
    "react/jsx-no-target-blank": "off",
    "react/prop-types": "off",
    // Allow `const { omit, ...rest } = obj` to drop a key without flagging the
    // intentionally-discarded sibling, and allow `_`-prefixed throwaways.
    "no-unused-vars": [
      "error",
      { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  overrides: [
    {
      // Build/tooling config files run in Node, not the browser.
      files: ["*.config.js", "*.config.cjs", ".eslintrc.cjs"],
      env: { node: true, browser: false },
    },
  ],
};
