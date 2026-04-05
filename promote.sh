#!/bin/bash
curl -X POST https://www.gardsguiden.se/api/setup/promote-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: $1" \
  -d '{"email":"sofie@sofiebergkvist.com"}'
