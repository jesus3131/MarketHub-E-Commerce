@echo off
set DATABASE_URL=postgresql://postgres:Jr200131@127.0.0.1:8001/ecommerce_db
set JWT_SECRET=super-secret-key-cambiar-en-produccion
cd /d "C:\Users\roble\OneDrive\Desktop\redes_server_e-commerce\report-service"
node server.js
