"""Unified CLI utility to lint and format Markdown files using pymarkdownlnt and mdformat."""

from __future__ import annotations

import argparse
import logging
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import NamedTuple

import mdformat

logger = logging.getLogger(__name__)


class LintViolation(NamedTuple):
    """Structured record for a pymarkdownlnt violation."""

    file_path: str
    line: int
    rule: str
    description: str


VIOLATION_PATTERN = re.compile(
    r"^(?P<file>.+?):(?P<line>\d+):(?:\d+:)?\s*(?P<rule>MD\d+):\s*(?P<desc>.+?)(?:\s*\([^)]+\))?$"
)


def _setup_logging(verbose: bool = False, quiet: bool = False) -> None:
    """Configure unified logging level and format for the markdown checker."""
    log_level = logging.INFO
    if verbose:
        log_level = logging.DEBUG
    elif quiet:
        log_level = logging.WARNING

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _find_markdown_files(target_path: Path) -> list[Path]:
    """Discover target markdown files from a single file or directory path."""
    if target_path.is_file():
        return [target_path] if target_path.suffix.lower() == ".md" else []
    if target_path.is_dir():
        return sorted(p for p in target_path.rglob("*.md") if "_html" not in p.parts and ".venv" not in p.parts)
    return []


def _format_markdown_file(file_path: Path) -> bool:
    """Format a single markdown file using mdformat with frontmatter and gfm extensions."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except OSError as err:
        logger.error("Error reading %s: %s", file_path, err)
        return False

    try:
        formatted = mdformat.text(content, extensions={"frontmatter", "gfm"})
    except Exception as err:
        logger.error("Error formatting %s: %s", file_path, err)
        return False

    if not formatted.endswith("\n"):
        formatted += "\n"

    if formatted != content:
        try:
            file_path.write_text(formatted, encoding="utf-8")
            return True
        except OSError as err:
            logger.error("Error writing %s: %s", file_path, err)
            return False
    return False


def _fix_markdown_files(files: list[Path]) -> tuple[int, int]:
    """Auto-format markdown files using mdformat.

    Returns:
        tuple[int, int]: (modified_count, unchanged_count)
    """
    modified = 0
    unchanged = 0
    for file_path in files:
        if _format_markdown_file(file_path):
            modified += 1
        else:
            unchanged += 1
    return modified, unchanged


def _run_pymarkdown(
    files: list[Path],
    config_path: Path | None = None,
    batch_size: int = 50,
) -> list[str]:
    """Execute pymarkdown scan subprocess on specified files in batches to prevent OS command length limits."""
    if not files:
        return []

    base_cmd = [sys.executable, "-m", "pymarkdown"]
    if config_path and config_path.is_file():
        base_cmd.extend(["--config", str(config_path)])
    else:
        base_cmd.extend(["-d", "MD013,MD041", "--enable-extensions", "front-matter"])

    base_cmd.append("scan")

    output_lines: list[str] = []
    total_batches = (len(files) + batch_size - 1) // batch_size
    for idx, i in enumerate(range(0, len(files), batch_size), start=1):
        chunk = files[i : i + batch_size]
        if total_batches > 1:
            logger.debug("Scanning batch %d/%d (%d files)...", idx, total_batches, len(chunk))
        cmd = base_cmd + [str(f) for f in chunk]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", check=False)
        if res.stdout:
            output_lines.extend(res.stdout.splitlines())
        if res.stderr:
            output_lines.extend(res.stderr.splitlines())
    return output_lines


def _parse_violations(output_lines: list[str]) -> list[LintViolation]:
    """Parse raw pymarkdown output lines into structured LintViolation records."""
    violations: list[LintViolation] = []
    for line in output_lines:
        line = line.strip()
        match = VIOLATION_PATTERN.match(line)
        if match:
            violations.append(
                LintViolation(
                    file_path=match.group("file"),
                    line=int(match.group("line")),
                    rule=match.group("rule"),
                    description=match.group("desc").strip(),
                )
            )
    return violations


def _log_lint_report(files: list[Path], violations: list[LintViolation]) -> None:
    """Log formatted summary table of lint violations grouped by rule."""
    lines = [
        "=" * 70,
        "Markdown Lint Summary",
        "=" * 70,
        f"Scanned files:    {len(files)}",
        f"Total violations: {len(violations)}",
    ]

    if not violations:
        lines.extend(
            [
                "",
                "All files passed markdown linting with 0 violations!",
                "=" * 70,
            ]
        )
        logger.info("\n" + "\n".join(lines))
        return

    rule_counts = Counter(v.rule for v in violations)
    rule_desc: dict[str, str] = {}
    for v in violations:
        if v.rule not in rule_desc:
            desc = v.description.split("[")[0].strip()
            rule_desc[v.rule] = desc

    lines.extend(
        [
            "",
            "Violations by Rule:",
            "-" * 70,
            f"{'Rule':<8} {'Count':<8} {'Description'}",
            "-" * 70,
        ]
    )
    for rule, count in rule_counts.most_common():
        desc = rule_desc.get(rule, "")
        lines.append(f"{rule:<8} {count:<8} {desc}")
    lines.append("=" * 70)

    logger.info("\n" + "\n".join(lines))


def lint_markdown(target_path: Path, config_path: Path | None = None) -> int:
    """Scan and lint markdown files, logging a summary table.

    Args:
        target_path: File or directory path to lint.
        config_path: Optional path to .pymarkdown.json configuration.

    Returns:
        int: Number of lint violations found (0 = clean).
    """
    files = _find_markdown_files(target_path)
    if not files:
        logger.warning("No markdown files found under %s", target_path)
        return 0

    output_lines = _run_pymarkdown(files, config_path=config_path)
    violations = _parse_violations(output_lines)
    _log_lint_report(files, violations)
    return len(violations)


def fix_markdown(target_path: Path, config_path: Path | None = None) -> int:
    """Format markdown files with mdformat, then re-lint and report remaining violations.

    Args:
        target_path: File or directory path to fix.
        config_path: Optional path to .pymarkdown.json configuration.

    Returns:
        int: Number of remaining lint violations after fixing.
    """
    files = _find_markdown_files(target_path)
    if not files:
        logger.warning("No markdown files found under %s", target_path)
        return 0

    logger.info("Formatting %d markdown file(s) with mdformat...", len(files))
    modified, unchanged = _fix_markdown_files(files)
    logger.info("Fix complete: %d file(s) modified, %d file(s) unchanged.", modified, unchanged)

    logger.info("Re-linting files to check remaining violations...")
    return lint_markdown(target_path, config_path=config_path)


def main() -> None:
    """CLI entrypoint for checking and fixing markdown formatting."""
    parser = argparse.ArgumentParser(
        description="Unified markdown linting and formatting utility (pymarkdownlnt + mdformat)."
    )
    parser.add_argument(
        "--lint",
        action="store_true",
        help="Scan markdown files and report violations.",
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Format markdown files with mdformat, then re-lint to show remaining issues.",
    )
    parser.add_argument(
        "--path",
        type=str,
        default="content",
        help="Target path or file to check/format (defaults to 'content').",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to pymarkdown configuration file (defaults to .pymarkdown.json if present).",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose debug logging (sets level to DEBUG).",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress informational output (sets level to WARNING).",
    )

    args = parser.parse_args()

    _setup_logging(verbose=args.verbose, quiet=args.quiet)

    repo_root = Path(__file__).resolve().parent.parent
    target_path = Path(args.path)
    if not target_path.is_absolute():
        target_path = repo_root / target_path

    config_path = Path(args.config) if args.config else repo_root / ".pymarkdown.json"
    if not config_path.is_file():
        config_path = None

    run_fix = args.fix
    run_lint = args.lint or not run_fix

    if run_fix:
        remaining = fix_markdown(target_path, config_path=config_path)
        sys.exit(1 if remaining > 0 else 0)
    elif run_lint:
        violations = lint_markdown(target_path, config_path=config_path)
        sys.exit(1 if violations > 0 else 0)


if __name__ == "__main__":
    main()
