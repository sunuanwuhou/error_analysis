#!/usr/bin/env bash
set -euo pipefail
docker exec xingce_v3_postgres psql -U xingce -d xingce -c "
SELECT se.entity_type, COUNT(*) AS c
FROM state_entities se
JOIN users u ON u.id = se.user_id
WHERE u.username = 'wesly' AND se.deleted_at = ''
GROUP BY se.entity_type
ORDER BY c DESC;
"
docker exec xingce_v3_postgres psql -U xingce -d xingce -c "
SELECT COUNT(*) AS total_entities
FROM state_entities se
JOIN users u ON u.id = se.user_id
WHERE u.username = 'wesly' AND se.deleted_at = '';
"
