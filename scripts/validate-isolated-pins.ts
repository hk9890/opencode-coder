#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import {
  HARNESS_SOURCE_PATH,
  OPENCODE_CODER_PACKAGE_NAME,
  OPENCODE_DYNATRACE_PACKAGE_NAME,
  OPENCODE_CONFIG_FIXTURE_PATH,
  readHarnessScaffoldDependenciesFromManifest,
  readIsolatedTestManifest,
} from "../tests/e2e/helpers/harness";

interface ValidationFailure {
  rule: string;
  message: string;
}

interface ValidationSuccess {
  ok: true;
}

interface ValidationError {
  ok: false;
  failures: ValidationFailure[];
}

export type ValidationResult = ValidationSuccess | ValidationError;

export interface IsolatedPinValidationInputs {
  manifestPins: Record<string, string>;
  sharedPluginSpecs: string[];
  harnessScaffoldDependencies: Record<string, string>;
  harnessSource: string;
}

function parsePluginArrayFromConfig(config: unknown): string[] {
  if (!config || typeof config !== "object") {
    return [];
  }

  const plugin = (config as { plugin?: unknown }).plugin;
  if (!Array.isArray(plugin)) {
    return [];
  }

  return plugin.filter((entry): entry is string => typeof entry === "string");
}

export function extractVersionSuffixFromPluginSpec(spec: string, packageName: string): string | null {
  const trimmedSpec = spec.trim();
  const prefix = `${packageName}@`;
  if (!trimmedSpec.startsWith(prefix)) {
    return null;
  }

  const version = trimmedSpec.slice(prefix.length).trim();
  return version.length > 0 ? version : null;
}

export function validateIsolatedPinsConsistencyFromInputs(inputs: IsolatedPinValidationInputs): ValidationResult {
  const failures: ValidationFailure[] = [];

  const pluginSpecs = inputs.sharedPluginSpecs;
  const dynatraceSpec = pluginSpecs.find((spec) => spec.trim().startsWith(`${OPENCODE_DYNATRACE_PACKAGE_NAME}@`));
  const dynatraceVersionFromConfig = dynatraceSpec
    ? extractVersionSuffixFromPluginSpec(dynatraceSpec, OPENCODE_DYNATRACE_PACKAGE_NAME)
    : null;
  const dynatraceVersionFromManifest = inputs.manifestPins[OPENCODE_DYNATRACE_PACKAGE_NAME];

  if (!dynatraceSpec) {
    failures.push({
      rule: "manifest dynatrace pin == shared config suffix",
      message: `Missing ${OPENCODE_DYNATRACE_PACKAGE_NAME}@<version> entry in ${OPENCODE_CONFIG_FIXTURE_PATH}`,
    });
  } else if (!dynatraceVersionFromConfig) {
    failures.push({
      rule: "manifest dynatrace pin == shared config suffix",
      message: `Plugin entry has no version suffix: ${dynatraceSpec}`,
    });
  } else if (dynatraceVersionFromConfig !== dynatraceVersionFromManifest) {
    failures.push({
      rule: "manifest dynatrace pin == shared config suffix",
      message: `Manifest pins ${OPENCODE_DYNATRACE_PACKAGE_NAME}@${dynatraceVersionFromManifest} but ${OPENCODE_CONFIG_FIXTURE_PATH} has ${dynatraceSpec}`,
    });
  }

  const configuredCoderEntries = pluginSpecs.filter((spec) => spec.trim().startsWith(`${OPENCODE_CODER_PACKAGE_NAME}@`));
  if (configuredCoderEntries.length > 0) {
    failures.push({
      rule: "shared config excludes configured @dynatrace-oss/opencode-coder",
      message: `${OPENCODE_CONFIG_FIXTURE_PATH} must not include ${OPENCODE_CODER_PACKAGE_NAME} plugin entries (found: ${configuredCoderEntries.join(", ")})`,
    });
  }

  const manifestPluginPin = inputs.manifestPins["@opencode-ai/plugin"];
  const harnessScaffoldDeps = inputs.harnessScaffoldDependencies;
  const scaffoldedPluginPin = harnessScaffoldDeps["@opencode-ai/plugin"];

  if (!scaffoldedPluginPin) {
    failures.push({
      rule: "manifest @opencode-ai/plugin pin == harness scaffold pins",
      message: "Harness scaffold dependencies do not include @opencode-ai/plugin",
    });
  } else if (scaffoldedPluginPin !== manifestPluginPin) {
    failures.push({
      rule: "manifest @opencode-ai/plugin pin == harness scaffold pins",
      message: `Manifest pins @opencode-ai/plugin@${manifestPluginPin} but harness scaffold resolves ${scaffoldedPluginPin}`,
    });
  }

  const packageWriterCalls = inputs.harnessSource.match(/await\s+installWorkspacePluginDependencies\(/g)?.length ?? 0;
  if (packageWriterCalls < 2) {
    failures.push({
      rule: "both harness package-writing paths source shared scaffold helper",
      message: `Expected both package-writing paths to call installWorkspacePluginDependencies(...) (found ${packageWriterCalls.toString()} in ${HARNESS_SOURCE_PATH})`,
    });
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  return { ok: true };
}

export async function validateIsolatedPinsConsistency(): Promise<ValidationResult> {
  const manifest = await readIsolatedTestManifest();
  const configRaw = await readFile(OPENCODE_CONFIG_FIXTURE_PATH, "utf8");
  const config = JSON.parse(configRaw) as unknown;
  const harnessSource = await readFile(HARNESS_SOURCE_PATH, "utf8");
  const harnessScaffoldDependencies = await readHarnessScaffoldDependenciesFromManifest();

  return validateIsolatedPinsConsistencyFromInputs({
    manifestPins: manifest.pins,
    sharedPluginSpecs: parsePluginArrayFromConfig(config),
    harnessScaffoldDependencies,
    harnessSource,
  });
}

export async function runValidationAndPrint(): Promise<number> {
  try {
    const result = await validateIsolatedPinsConsistency();
    if (result.ok) {
      console.log("Isolated pin consistency check passed.");
      return 0;
    }

    console.error("Isolated pin consistency check failed:");
    for (const failure of result.failures) {
      console.error(`- [${failure.rule}] ${failure.message}`);
    }
    return 1;
  } catch (error) {
    console.error(`Isolated pin consistency check failed: ${(error as Error).message}`);
    return 1;
  }
}

if (import.meta.main) {
  const code = await runValidationAndPrint();
  process.exit(code);
}
