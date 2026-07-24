#!/usr/bin/env bash
set -euo pipefail
docker exec xingce_v3_postgres psql -U xingce -d xingce -c "
WITH ranked AS (
  SELECT se.entity_type, se.entity_id, se.updated_at,
         ROW_NUMBER() OVER (ORDER BY se.updated_at ASC, se.entity_type ASC, se.entity_id ASC) AS rn
  FROM state_entities se
  JOIN users u ON u.id = se.user_id
  WHERE u.username = 'wesly' AND se.deleted_at = ''
)
SELECT entity_type, COUNT(*) AS c
FROM ranked
WHERE rn <= 50
GROUP BY entity_type
ORDER BY c DESC;
"
