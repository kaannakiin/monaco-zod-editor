import { globalIgnores } from "eslint/config";
import { config as baseConfig } from "./base.js";
import angular from "angular-eslint";

/**
 * A shared ESLint configuration for Angular applications.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const angularConfig = [
  ...baseConfig,
  globalIgnores([".angular/**", "dist/**", "out-tsc/**"]),
  ...angular.configs.tsRecommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    ...angular.configs.templateRecommended[0],
    ...angular.configs.templateAccessibility[0],
  },
];
