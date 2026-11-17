#!/bin/sh
# Netlify `[build] ignore` command: exit 0 skips the build, any other exit builds.
# Tested by src/__tests__/netlifyIgnore.test.ts.
#
# Build minutes are limited, so a push is not a build by default:
#   1. A PR deploy preview or branch deploy builds only when the head commit's
#      message contains [preview]. Add it when a real Netlify deploy is needed
#      (CDN, Image CDN, Lighthouse); verify everything else locally.
#   2. Any deploy is skipped when only plans/, docs/ or markdown changed since the
#      last commit Netlify built (CACHED_COMMIT_REF).
# Production (the staging site's master) builds on any change that ships.
#
# It fails safe: if a command cannot run (no readable commit, no cached commit
# yet), the exit is non-zero and Netlify builds, so a doubt always builds.
# Netlify's [skip netlify] tag does not stop PR previews, hence rule 1.

case "$CONTEXT" in
  deploy-preview | branch-deploy)
    MSG=$(git log -1 --format=%B "$COMMIT_REF") || exit 1
    case "$MSG" in
      *"[preview]"*) ;;
      *) exit 0 ;;
    esac
    ;;
esac

git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . ':(exclude)plans' ':(exclude)docs' ':(exclude,glob)**/*.md'
