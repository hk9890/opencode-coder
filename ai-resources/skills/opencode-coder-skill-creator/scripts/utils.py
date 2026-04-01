"""Shared utilities for skill-creator scripts."""

import re
from pathlib import Path


def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:") :].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:") :].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (
                    frontmatter_lines[i].startswith("  ")
                    or frontmatter_lines[i].startswith("\t")
                ):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    return name, description, content


def derive_runtime_skill_name(frontmatter_name: str) -> str:
    """Map package-facing skill name to runtime tool name.

    Example:
    - opencode-coder-skill-creator -> skill-creator
    """
    if frontmatter_name.startswith("opencode-coder-"):
        return frontmatter_name[len("opencode-coder-") :]
    if frontmatter_name.startswith("opencode-"):
        return frontmatter_name[len("opencode-") :]
    return frontmatter_name


def derive_runtime_skill_names(frontmatter_name: str) -> list[str]:
    """Return candidate runtime skill names for signal matching.

    OpenCode runtimes may emit either the package-facing frontmatter name
    (for example ``opencode-coder-skill-creator``) or a stripped runtime name
    (for example ``skill-creator``). Keep detection resilient by matching both.
    """

    candidates = [frontmatter_name]
    derived_name = derive_runtime_skill_name(frontmatter_name)
    if derived_name not in candidates:
        candidates.append(derived_name)
    return candidates


def replace_frontmatter_description(skill_markdown: str, new_description: str) -> str:
    """Replace `description:` inside YAML frontmatter and return updated markdown."""
    lines = skill_markdown.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    # find frontmatter end
    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    frontmatter = lines[1:end_idx]
    body = lines[end_idx + 1 :]

    out_frontmatter: list[str] = []
    i = 0
    replaced = False
    while i < len(frontmatter):
        line = frontmatter[i]
        if line.startswith("description:") and not replaced:
            out_frontmatter.append(f'description: "{new_description}"')
            replaced = True
            i += 1
            # Skip continuation block if present
            while i < len(frontmatter) and (
                frontmatter[i].startswith("  ") or frontmatter[i].startswith("\t")
            ):
                i += 1
            continue
        out_frontmatter.append(line)
        i += 1

    if not replaced:
        out_frontmatter.append(f'description: "{new_description}"')

    rebuilt = ["---", *out_frontmatter, "---", *body]
    return "\n".join(rebuilt).rstrip() + "\n"


def ensure_dir(path: Path) -> None:
    """Create a directory path if needed."""
    path.mkdir(parents=True, exist_ok=True)


def json_default(value):
    """JSON serializer fallback for non-serializable objects."""
    if isinstance(value, Path):
        return str(value)
    return str(value)


def sanitize_label(value: str) -> str:
    """Return a filesystem-safe label for artifact names."""
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-._")
    return cleaned or "unnamed"


def resolve_relative_path(
    base_dir: Path, relative_path: str, label: str = "path"
) -> Path:
    """Resolve a relative path safely under ``base_dir``.

    Raises ValueError when the path is absolute or escapes ``base_dir``.
    """

    rel = Path(relative_path)
    if rel.is_absolute():
        raise ValueError(f"{label} must be relative: {relative_path}")

    resolved = (base_dir / rel).resolve()
    base_resolved = base_dir.resolve()
    if base_resolved != resolved and base_resolved not in resolved.parents:
        raise ValueError(f"{label} escapes skill root: {relative_path}")

    return resolved


def hook_display_name(hook: dict) -> str:
    """Resolve display name for a hook entry."""
    explicit = hook.get("name")
    if explicit and str(explicit).strip():
        return str(explicit).strip()
    return Path(str(hook.get("script", "hook"))).name
