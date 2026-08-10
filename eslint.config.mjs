import next from "eslint-config-next"

// eslint-config-next 16 ships a native flat config. The template's FlatCompat
// shim was for the older eslintrc format and throws on this version.
const config = [
  {
    ignores: [".next/**", "node_modules/**", "data/**", "backups/**"],
  },
  ...next,
]

export default config
