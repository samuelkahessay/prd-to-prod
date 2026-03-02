#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  check-autonomy-policy.sh validate [policy-path]
  check-autonomy-policy.sh resolve <action> [policy-path]
  check-autonomy-policy.sh match <action> <target-path> [policy-path]
USAGE
  exit 2
}

command -v ruby >/dev/null 2>&1 || { echo "Error: ruby is required" >&2; exit 1; }

[ "$#" -ge 1 ] || usage

COMMAND="$1"
shift

case "$COMMAND" in
  validate)
    POLICY_PATH="${1:-autonomy-policy.yml}"
    ;;
  resolve)
    [ "$#" -ge 1 ] || usage
    ACTION_NAME="$1"
    POLICY_PATH="${2:-autonomy-policy.yml}"
    ;;
  match)
    [ "$#" -ge 2 ] || usage
    ACTION_NAME="$1"
    TARGET_PATH="$2"
    POLICY_PATH="${3:-autonomy-policy.yml}"
    ;;
  *)
    usage
    ;;
esac

ruby - "$COMMAND" "$POLICY_PATH" "${ACTION_NAME:-}" "${TARGET_PATH:-}" <<'RUBY'
require "date"
require "json"
require "yaml"

command = ARGV[0]
policy_path = ARGV[1]
action_name = ARGV[2]
target_path = ARGV[3]

def emit(payload, ok:)
  puts JSON.pretty_generate(payload)
  exit(ok ? 0 : 1)
end

def load_policy(path)
  YAML.safe_load(
    File.read(path),
    permitted_classes: [Date],
    aliases: false
  )
rescue Errno::ENOENT
  emit({
    ok: false,
    error: "file_not_found",
    path: path
  }, ok: false)
rescue Psych::Exception => e
  emit({
    ok: false,
    error: "invalid_yaml",
    path: path,
    detail: e.message
  }, ok: false)
end

def validate_policy(policy, path)
  errors = []

  unless policy.is_a?(Hash)
    errors << "root must be a mapping"
    return errors
  end

  version = policy["version"]
  errors << "version must be an integer" unless version.is_a?(Integer)

  defaults = policy["defaults"]
  unless defaults.is_a?(Hash)
    errors << "defaults must be a mapping"
    defaults = {}
  end

  unknown_action = defaults["unknown_action"]
  unless %w[autonomous human_required].include?(unknown_action)
    errors << "defaults.unknown_action must be autonomous or human_required"
  end

  fail_closed = defaults["fail_closed"]
  unless fail_closed == true || fail_closed == false
    errors << "defaults.fail_closed must be a boolean"
  end

  escalation_rule = defaults["escalation_rule"]
  unless escalation_rule.is_a?(String) && !escalation_rule.strip.empty?
    errors << "defaults.escalation_rule must be a non-empty string"
  end

  actions = policy["actions"]
  unless actions.is_a?(Array) && !actions.empty?
    errors << "actions must be a non-empty array"
    return errors
  end

  seen_actions = {}
  actions.each_with_index do |entry, index|
    prefix = "actions[#{index}]"
    unless entry.is_a?(Hash)
      errors << "#{prefix} must be a mapping"
      next
    end

    name = entry["action"]
    if !name.is_a?(String) || name.strip.empty?
      errors << "#{prefix}.action must be a non-empty string"
    elsif seen_actions[name]
      errors << "#{prefix}.action duplicates #{name}"
    else
      seen_actions[name] = true
    end

    scope = entry["scope"]
    errors << "#{prefix}.scope must be a non-empty string" unless scope.is_a?(String) && !scope.strip.empty?

    mode = entry["default_mode"]
    unless %w[autonomous human_required].include?(mode)
      errors << "#{prefix}.default_mode must be autonomous or human_required"
    end

    reason = entry["requires_human_reason"]
    if mode == "human_required" && !(reason.is_a?(String) && !reason.strip.empty?)
      errors << "#{prefix}.requires_human_reason must be a non-empty string when default_mode is human_required"
    end

    allowed_targets = entry["allowed_targets"]
    unless allowed_targets.is_a?(Array) && !allowed_targets.empty? && allowed_targets.all? { |v| v.is_a?(String) && !v.strip.empty? }
      errors << "#{prefix}.allowed_targets must be a non-empty array of strings"
    end

    evidence_required = entry["evidence_required"]
    unless evidence_required.is_a?(Array) && !evidence_required.empty? && evidence_required.all? { |v| v.is_a?(String) && !v.strip.empty? }
      errors << "#{prefix}.evidence_required must be a non-empty array of strings"
    end
  end

  errors
end

def target_matches?(pattern, target)
  if pattern.end_with?("/**")
    prefix = pattern.sub(%r{/\*\*$}, "/")
    unless prefix.include?("*") || prefix.include?("?")
      return target.start_with?(prefix)
    end
    return File.fnmatch?(pattern, target, File::FNM_DOTMATCH | File::FNM_EXTGLOB)
  end

  File.fnmatch?(pattern, target, File::FNM_PATHNAME | File::FNM_DOTMATCH | File::FNM_EXTGLOB)
end

policy = load_policy(policy_path)
errors = validate_policy(policy, policy_path)

if command == "validate"
  emit({
    ok: errors.empty?,
    path: policy_path,
    version: policy["version"],
    action_count: policy.fetch("actions", []).is_a?(Array) ? policy.fetch("actions", []).length : 0,
    errors: errors
  }, ok: errors.empty?)
end

if !errors.empty?
  emit({
    ok: false,
    error: "invalid_policy",
    path: policy_path,
    errors: errors
  }, ok: false)
end

defaults = policy.fetch("defaults")
action = policy.fetch("actions").find { |entry| entry["action"] == action_name }

if action
  if command == "match"
    matched_target = action["allowed_targets"].find { |pattern| target_matches?(pattern, target_path) }

    emit({
      ok: true,
      path: policy_path,
      found: true,
      matched: !matched_target.nil?,
      matched_target: matched_target,
      target_path: target_path,
      action: action["action"],
      mode: action["default_mode"],
      requires_human_reason: action["requires_human_reason"],
      allowed_targets: action["allowed_targets"],
      evidence_required: action["evidence_required"]
    }, ok: true)
  end

  emit({
    ok: true,
    path: policy_path,
    found: true,
    action: action["action"],
    mode: action["default_mode"],
    requires_human_reason: action["requires_human_reason"],
    allowed_targets: action["allowed_targets"],
    evidence_required: action["evidence_required"]
  }, ok: true)
end

if command == "match"
  emit({
    ok: true,
    path: policy_path,
    found: false,
    matched: false,
    matched_target: nil,
    target_path: target_path,
    action: action_name,
    mode: defaults["unknown_action"],
    requires_human_reason: "No explicit policy entry matched this action. Failing closed per defaults.",
    allowed_targets: [],
    evidence_required: [defaults["escalation_rule"]],
    fail_closed: defaults["fail_closed"]
  }, ok: true)
end

emit({
  ok: true,
  path: policy_path,
  found: false,
  action: action_name,
  mode: defaults["unknown_action"],
  requires_human_reason: "No explicit policy entry matched this action. Failing closed per defaults.",
  allowed_targets: [],
  evidence_required: [defaults["escalation_rule"]],
  fail_closed: defaults["fail_closed"]
}, ok: true)
RUBY
