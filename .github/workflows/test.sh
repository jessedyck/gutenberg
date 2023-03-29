#!/bin/bash

PACKAGE_PATH="packages/components/src"
CHANGELOG_PATH="packages/components/CHANGELOG.md"
CHANGED_FILES="$(git diff --name-only origin/trunk...HEAD)"
if echo "$CHANGED_FILES" | grep -q "^$PACKAGE_PATH/"; then
	echo "Please add a changelog entry for the Components package."
	exit 1
fi
