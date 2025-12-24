#!/bin/bash
set -e

# Wrapper for core Lambda deployment
"$(dirname "$0")/deploy-lambda-generic.sh" core cwf-core-lambda