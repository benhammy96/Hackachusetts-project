#!/usr/bin/env bash
# Installs a project-local Node runtime into .toolchain/node.
#
# Atlas needs Node >= 20.19 or >= 22.12 (Vitest 5's bundler ships no binary for
# older releases). This script keeps that requirement out of your system or
# Homebrew install.
#
#   ./scripts/setup-node.sh
#   export PATH="$PWD/.toolchain/node/bin:$PATH"

set -euo pipefail

VERSION="${NODE_VERSION:-v24.22.1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/.toolchain"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)  PLATFORM="darwin-arm64" ;;
  Darwin-x86_64) PLATFORM="darwin-x64" ;;
  Linux-aarch64) PLATFORM="linux-arm64" ;;
  Linux-x86_64)  PLATFORM="linux-x64" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

if [ -x "$DEST/node/bin/node" ]; then
  echo "Already installed: $("$DEST/node/bin/node" -v)"
  exit 0
fi

mkdir -p "$DEST"
TARBALL="node-$VERSION-$PLATFORM.tar.xz"
echo "Downloading $TARBALL ..."
curl -fsSL -o "$DEST/$TARBALL" "https://nodejs.org/dist/$VERSION/$TARBALL"
tar -xf "$DEST/$TARBALL" -C "$DEST"
rm "$DEST/$TARBALL"
mv "$DEST/node-$VERSION-$PLATFORM" "$DEST/node"

echo "Installed $("$DEST/node/bin/node" -v) at .toolchain/node"
echo 'Add it to your PATH:  export PATH="$PWD/.toolchain/node/bin:$PATH"'
