#!/bin/bash
set -e

# Wrapper for sari-sari-chat Lambda deployment
"$(dirname "$0")/../../scripts/deploy-lambda-generic.sh" sari-sari-chat cwf-sari-sari-chat
