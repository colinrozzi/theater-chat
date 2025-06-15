#!/bin/bash
cd /Users/colinrozzi/work/tools/theater-chat
echo "Running TypeScript compilation check..."
npx tsc --noEmit > /tmp/tsc-check.log 2>&1
echo "Exit code: $?"
echo "Output:"
cat /tmp/tsc-check.log
