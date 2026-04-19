#!/usr/bin/env bash

set -euo pipefail

fail() {
  printf 'aimgr install: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

detect_os() {
  case "$(uname -s)" in
    Linux) printf 'linux' ;;
    Darwin) printf 'darwin' ;;
    *) fail "unsupported operating system: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) printf 'amd64' ;;
    arm64 | aarch64) printf 'arm64' ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
    return
  fi

  fail "sha256sum or shasum is required"
}

AIMGR_VERSION="${AIMGR_VERSION:?AIMGR_VERSION must be set}"
AIMGR_GITHUB_REPO="${AIMGR_GITHUB_REPO:-dynatrace-oss/ai-config-manager}"
AIMGR_INSTALL_DIR="${AIMGR_INSTALL_DIR:-$HOME/.local/bin}"

case "$AIMGR_INSTALL_DIR" in
  '~')
    AIMGR_INSTALL_DIR="$HOME"
    ;;
  '~/'*)
    AIMGR_INSTALL_DIR="$HOME/${AIMGR_INSTALL_DIR#~/}"
    ;;
esac

AIMGR_BIN="$AIMGR_INSTALL_DIR/aimgr"

mkdir -p "$AIMGR_INSTALL_DIR"

if [ -x "$AIMGR_BIN" ]; then
  if [ -n "${GITHUB_PATH:-}" ]; then
    printf '%s\n' "$AIMGR_INSTALL_DIR" >> "$GITHUB_PATH"
  fi

  export PATH="$AIMGR_INSTALL_DIR:$PATH"
  printf 'Using cached aimgr binary at %s\n' "$AIMGR_BIN"
  command -v aimgr
  aimgr --version
  exit 0
fi

require_cmd gh
require_cmd tar
require_cmd awk
require_cmd install

os="$(detect_os)"
arch="$(detect_arch)"
asset="aimgr_${AIMGR_VERSION}_${os}_${arch}.tar.gz"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}

trap cleanup EXIT INT HUP TERM

printf 'Downloading aimgr %s for %s/%s from %s\n' "$AIMGR_VERSION" "$os" "$arch" "$AIMGR_GITHUB_REPO"

gh release download "v${AIMGR_VERSION}" \
  --repo "$AIMGR_GITHUB_REPO" \
  --pattern "$asset" \
  --pattern 'checksums.txt' \
  --dir "$tmp_dir"

expected_checksum="$({ awk -v asset="$asset" '$2 == asset || $2 == "*" asset { print $1; exit }' "$tmp_dir/checksums.txt"; } || true)"
[ -n "$expected_checksum" ] || fail "checksum not found for $asset"

actual_checksum="$(hash_file "$tmp_dir/$asset")"
[ "$actual_checksum" = "$expected_checksum" ] || fail "checksum verification failed for $asset"

tar -xzf "$tmp_dir/$asset" -C "$tmp_dir"
[ -f "$tmp_dir/aimgr" ] || fail "archive did not contain aimgr binary"

install -m 0755 "$tmp_dir/aimgr" "$AIMGR_BIN"

if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$AIMGR_INSTALL_DIR" >> "$GITHUB_PATH"
fi

export PATH="$AIMGR_INSTALL_DIR:$PATH"
command -v aimgr
aimgr --version
