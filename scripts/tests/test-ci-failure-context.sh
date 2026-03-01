#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/extract-failure-context.sh"

BUILD_LOG=$(cat <<'LOG'
build-and-test	Run dotnet build TicketDeflection.sln --no-restore	2026-02-28T00:50:02.4991006Z ##[error]/home/runner/work/prd-to-prod/prd-to-prod/TicketDeflection/obj/Debug/net8.0/Pages_Dashboard_cshtml.g.cs(187,71): error CS0246: The type or namespace name 'DashboardModel' could not be found [/home/runner/work/prd-to-prod/prd-to-prod/TicketDeflection/TicketDeflection.csproj]
build-and-test	Run dotnet build TicketDeflection.sln --no-restore	2026-02-28T00:50:02.5743884Z Build FAILED.
LOG
)

TEST_LOG=$(cat <<'LOG'
build-and-test	Run dotnet test TicketDeflection.sln --no-build --verbosity normal	2026-02-28T01:39:57.1310829Z [xUnit.net 00:00:01.23]     TicketDeflection.Tests.HealthTests.Run_Returns200 [FAIL]
build-and-test	Run dotnet test TicketDeflection.sln --no-build --verbosity normal	2026-02-28T01:39:57.1310830Z   Failed TicketDeflection.Tests.HealthTests.Run_Returns200 [15 ms]
build-and-test	Run dotnet test TicketDeflection.sln --no-build --verbosity normal	2026-02-28T01:39:57.1310831Z   Error Message:
build-and-test	Run dotnet test TicketDeflection.sln --no-build --verbosity normal	2026-02-28T01:39:57.1310832Z    Assert.Equal() Failure: Expected 200, Actual 500
LOG
)

BUILD_JSON=$(printf '%s' "$BUILD_LOG" | "$SCRIPT")
TEST_JSON=$(printf '%s' "$TEST_LOG" | "$SCRIPT")

printf '%s' "$BUILD_JSON" | jq -e '.failure_type == "build"' >/dev/null
printf '%s' "$BUILD_JSON" | jq -e '.failure_signature | startswith("cs0246")' >/dev/null
printf '%s' "$BUILD_JSON" | jq -e '.summary | contains("error CS0246")' >/dev/null
printf '%s' "$BUILD_JSON" | jq -e '.excerpt | contains("Build FAILED")' >/dev/null

printf '%s' "$TEST_JSON" | jq -e '.failure_type == "test"' >/dev/null
printf '%s' "$TEST_JSON" | jq -e '.failure_signature == "test-ticketdeflection-tests-healthtests-run-returns200"' >/dev/null
printf '%s' "$TEST_JSON" | jq -e '.summary | contains("Failed TicketDeflection.Tests.HealthTests.Run_Returns200")' >/dev/null
printf '%s' "$TEST_JSON" | jq -e '.excerpt | contains("Assert.Equal() Failure")' >/dev/null

echo "extract-failure-context.sh tests passed"
