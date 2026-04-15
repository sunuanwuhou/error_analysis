-- 用户统计
SELECT '=== 用户统计 ===' as info;
SELECT COUNT(*) as user_count FROM users;
SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5;

-- 练习统计
SELECT '=== 练习统计 ===' as info;
SELECT COUNT(*) as practice_count FROM practice_attempts;

-- 云备份统计
SELECT '=== 云备份统计 ===' as info;
SELECT COUNT(*) as backup_count FROM user_backups;

-- 图片统计
SELECT '=== 图片统计 ===' as info;
SELECT COUNT(*) as image_count, COALESCE(SUM(size_bytes), 0) as total_bytes FROM user_images;

-- 同步统计
SELECT '=== 同步统计 ===' as info;
SELECT COUNT(*) as sync_status_count FROM user_origin_status;
SELECT COUNT(*) as operation_count FROM operations;
