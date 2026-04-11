import { describe, expect, it } from "bun:test";
import {
  extractVersionSuffixFromPluginSpec,
  validateIsolatedPinsConsistencyFromInputs,
} from "../../scripts/validate-isolated-pins";
import {
  OPENCODE_DYNATRACE_PACKAGE_NAME,
  readHarnessScaffoldDependenciesFromManifest,
  readIsolatedTestManifest,
} from "../e2e/helpers/harness";

describe("validate-isolated-pins", () => {
  it("reads harness scaffold plugin pin from shared manifest", async () => {
    const manifest = await readIsolatedTestManifest();
    const scaffoldDeps = await readHarnessScaffoldDependenciesFromManifest();

    expect(scaffoldDeps["@opencode-ai/plugin"]).toBe(manifest.pins["@opencode-ai/plugin"]);
  });

  it("extracts version suffix only for matching plugin specs", () => {
    expect(extractVersionSuffixFromPluginSpec("@hk9890/opencode-dynatrace@0.6.0", OPENCODE_DYNATRACE_PACKAGE_NAME)).toBe(
      "0.6.0"
    );
    expect(extractVersionSuffixFromPluginSpec("@hk9890/opencode-dynatrace", OPENCODE_DYNATRACE_PACKAGE_NAME)).toBeNull();
    expect(extractVersionSuffixFromPluginSpec("@dynatrace-oss/opencode-coder@0.34.2", OPENCODE_DYNATRACE_PACKAGE_NAME)).toBeNull();
  });

  it("passes when manifest, shared config, and harness scaffolding are consistent", () => {
    const result = validateIsolatedPinsConsistencyFromInputs({
      manifestPins: {
        "@hk9890/opencode-dynatrace": "0.6.0",
        "@opencode-ai/plugin": "^1.3.17",
      },
      sharedPluginSpecs: ["@hk9890/opencode-dynatrace@0.6.0"],
      harnessScaffoldDependencies: {
        "@opencode-ai/plugin": "^1.3.17",
      },
      harnessSource:
        "await installWorkspacePluginDependencies(workdir, ['@hk9890/opencode-dynatrace@0.6.0', '@dynatrace-oss/opencode-coder@0.34.2']);",
    });

    expect(result.ok).toBe(true);
  });

  it("fails when drift is detected across configured rules", () => {
    const result = validateIsolatedPinsConsistencyFromInputs({
      manifestPins: {
        "@hk9890/opencode-dynatrace": "0.6.0",
        "@opencode-ai/plugin": "^1.3.17",
      },
      sharedPluginSpecs: ["@hk9890/opencode-dynatrace@0.7.0", "@dynatrace-oss/opencode-coder@0.34.2"],
      harnessScaffoldDependencies: {
        "@opencode-ai/plugin": "^1.2.17",
      },
      harnessSource: "await someOtherHelper(workdir);",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failures.some((failure) => failure.rule.includes("manifest dynatrace pin"))).toBe(true);
    expect(
      result.failures.some((failure) =>
        failure.rule.includes("shared config excludes configured @dynatrace-oss/opencode-coder")
      )
    ).toBe(true);
    expect(result.failures.some((failure) => failure.rule.includes("manifest @opencode-ai/plugin pin"))).toBe(true);
    expect(result.failures.some((failure) => failure.rule.includes("installed-configured package prep"))).toBe(true);
  });
});
