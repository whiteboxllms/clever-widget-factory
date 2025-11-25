# Legacy Ops Scripts

This directory stores one-off SQL/sh/bash helpers that were used during the Supabase→AWS
migration and various emergency maintenance tasks (password rotations, manual RLS fixes,
etc.). They stay under version control for reference/audit purposes, but they are *not*
part of the current deployment workflow. New automation should live under `scripts/`
and infrastructure-as-code.

> **Security note:** Any files that previously contained production credentials (e.g.
> `latest_backup.sql`, plaintext rotation scripts) have been removed or sanitized.
> When running these utilities, source secrets from AWS Secrets Manager / SSM or pass
> them as environment variables—do not hard-code passwords back into the repo.
