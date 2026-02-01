#!/bin/bash
# Fix sherpa-onnx.node rpath for macOS
# The native module has a hardcoded rpath from build time that doesn't exist
# We need to change it to @loader_path so it finds dylibs in its own directory

set -e

echo "[FixSherpaRpath] Fixing sherpa-onnx rpath..."

# Platform-specific directories
SHERPA_ARM64="node_modules/sherpa-onnx-darwin-arm64"
SHERPA_X64="node_modules/sherpa-onnx-darwin-x64"

# Function to fix rpath for a specific platform directory
fix_rpath() {
  local dir="$1"
  local node_file="$dir/sherpa-onnx.node"

  if [ ! -f "$node_file" ]; then
    echo "[FixSherpaRpath] Skipping $dir (not found)"
    return
  fi

  echo "[FixSherpaRpath] Processing $node_file"

  # Remove ALL existing rpaths by reading them directly
  # We need to run install_name_tool multiple times to remove each rpath
  # The rpaths are checked one by one until only @loader_path remains

  # Try to remove known problematic rpaths
  install_name_tool -delete_rpath /Users/runner/work/sherpa-onnx/sherpa-onnx/build/install/lib "$node_file" 2>/dev/null || true

  # Remove any absolute path rpaths (these are project-specific and not portable)
  local abs_rpath=$(otool -l "$node_file" | grep -A1 "cmd LC_RPATH" | grep "path /^" | awk '{print $2}' | head -1)
  while [ -n "$abs_rpath" ]; do
    echo "[FixSherpaRpath] Removing rpath: $abs_rpath"
    install_name_tool -delete_rpath "$abs_rpath" "$node_file" 2>/dev/null || true
    abs_rpath=$(otool -l "$node_file" | grep -A1 "cmd LC_RPATH" | grep "path /^" | awk '{print $2}' | head -1)
  done

  # Check if @loader_path already exists
  if ! otool -l "$node_file" | grep -q "path @loader_path"; then
    # Add @loader_path as rpath (refers to the .node file's directory)
    install_name_tool -add_rpath @loader_path "$node_file"
    echo "[FixSherpaRpath] Added @loader_path rpath"
  else
    echo "[FixSherpaRpath] @loader_path rpath already exists"
  fi

  echo "[FixSherpaRpath] Fixed rpath in $node_file"
}

# Fix for both architectures if they exist
fix_rpath "$SHERPA_ARM64"
fix_rpath "$SHERPA_X64"

echo "[FixSherpaRpath] Done!"
