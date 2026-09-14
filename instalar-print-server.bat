@echo off
echo ============================================
echo   INSTALACION PIK'TA Print Server
echo   Ejecutar UNA SOLA VEZ como Administrador
echo ============================================
echo.

echo [1/3] Instalando PM2 globalmente...
npm install -g pm2
npm install -g pm2-windows-startup
echo.

echo [2/3] Iniciando Print Server con PM2...
cd /d C:\Users\DAVIS\pikta-print-server
pm2 start server.js --name pikta-print
echo.

echo [3/3] Configurando auto-start en Windows...
pm2 save
pm2-startup install
echo.

echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo   El Print Server arrancara SOLO cada vez
echo   que la PC se encienda.
echo.
echo   NO necesitas ngrok ni configurar nada mas.
echo   El servidor busca trabajos en Render cada 5s.
echo.
echo   Para verificar: pm2 status
echo   Para ver logs:   pm2 logs pikta-print
echo   Para reiniciar:  pm2 restart pikta-print
echo   Para detener:    pm2 stop pikta-print
echo.
pause
