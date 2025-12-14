-- 创建智学伴数据库
-- 使用方法：sqlcmd -S localhost -U sa -P 123456 -i 创建数据库.sql

-- 检查数据库是否存在，如果不存在则创建
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ZhixueBan')
BEGIN
    CREATE DATABASE ZhixueBan;
    PRINT '数据库 ZhixueBan 创建成功！';
END
ELSE
BEGIN
    PRINT '数据库 ZhixueBan 已存在！';
END
GO

-- 使用数据库
USE ZhixueBan;
GO

-- 确认数据库已创建
SELECT name, database_id, create_date 
FROM sys.databases 
WHERE name = 'ZhixueBan';
GO
