# frontend (migration target)

This directory is the target Vue frontend for future product work.

Current state:

- runtime `/` is still served by the legacy shell (`v51_frontend` path via backend router)
- this directory is not yet the production entrypoint

Rules:

- new frontend feature work should go here
- legacy directories (`xingce_v3/`, `v51_frontend/`) are bugfix/compatibility only
- do not claim migration cutover in docs until routing actually switches
