/** Jest config for shoplift-alerts unit tests */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/lib/shoplift-alerts"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};
