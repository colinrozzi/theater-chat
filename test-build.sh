#!/bin/bash
cd /Users/colinrozzi/work/tools/theater-chat
echo "=== TypeScript Compilation Check ==="
npx tsc --noEmit > build.md 2>&1
exit_code=$?
echo "Exit code: $exit_code"
if [ $exit_code -eq 0 ]; then
  echo "✅ TypeScript compilation successful!"
else
  echo "❌ TypeScript compilation failed. Check build.md for errors."
  echo "First 10 errors:"
  head -n 20 build.md
fi
