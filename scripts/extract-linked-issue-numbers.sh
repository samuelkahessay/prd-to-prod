#!/usr/bin/env bash
set -euo pipefail

TARGET_REPO="${1:-}"

TARGET_REPO="$TARGET_REPO" perl -0ne '
  my $target = lc($ENV{TARGET_REPO} // q{});
  my %seen;

  while (/(?i)(?:close[ds]?|fix(?:e[ds])?|resolve[ds]?)\s+(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#([0-9]+)\b/g) {
    my ($repo, $issue) = ($1 // q{}, $2);
    next if $target ne q{} && $repo ne q{} && lc($repo) ne $target;
    next if $seen{$issue}++;
    print "$issue\n";
  }
'
