import { describe, expect, it } from "bun:test";
import { getInstallGuideTemplate } from "../../src/templates";

describe("getInstallGuideTemplate", () => {
  it("continues initialization in the same session after prerequisites are resolved", () => {
    const template = getInstallGuideTemplate();

    expect(template).toContain("continue directly with enablement, refresh, or mode switching in THIS SAME SESSION");
    expect(template).toContain("Do NOT tell the user to re-run `/opencode-coder/init`");
    expect(template).not.toContain("Then run `/opencode-coder/init` again to continue.");
  });

  it("includes fallback AGENTS generation guidance", () => {
    const template = getInstallGuideTemplate();

    expect(template).toContain("### Step 4: AGENTS.md Creation");
    expect(template).toContain("Fallback path if the skill is not yet available in this session");
    expect(template).toContain("team mode writes `AGENTS.md`");
    expect(template).toContain("stealth mode writes `.coder/AGENTS.md`");
  });

  it("includes explicit initialized-project action selection and mode switching guidance", () => {
    const template = getInstallGuideTemplate();

    expect(template).toContain("#### Active or legacy-migrated project");
    expect(template).toContain("`Switch to team mode`");
    expect(template).toContain("`Switch to stealth mode`");
    expect(template).toContain("#### Transition Workflow: Stealth → Team");
    expect(template).toContain("#### Transition Workflow: Team → Stealth");
  });

  it("documents explicit saved disabled mode and the env hard override distinction", () => {
    const template = getInstallGuideTemplate();

    expect(template).toContain("Saved mode file: `.coder/opencode-coder.yaml`");
    expect(template).toContain("Saved disabled project");
    expect(template).toContain("`OPENCODE_CODER_DISABLED=true` environment variable");
    expect(template).toContain("this is different from `OPENCODE_CODER_DISABLED`");
  });

  it("describes fresh not-yet-enabled flow without treating .coder as activation", () => {
    const template = getInstallGuideTemplate();

    expect(template).toContain("Fresh or not-yet-enabled project");
    expect(template).toContain("DO NOT treat `.coder/` existence by itself as activation");
    expect(template).toContain("create `.coder/` only then");
  });
});
