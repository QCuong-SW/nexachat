-- Tạo database riêng cho integration tests để không ảnh hưởng dữ liệu dev
SELECT 'CREATE DATABASE nexa_chat_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexa_chat_test')\gexec
