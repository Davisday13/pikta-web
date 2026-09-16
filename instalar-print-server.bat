@echo off
echo ============================================
echo   INSTALACION PIK'TA Print Server
echo   Ejecutar como Administrador
echo ============================================
echo.

echo [1/3] Instalando PM2...
npm install -g pm2
if %errorlevel% neq 0 (
    echo ERROR: No se pudo instalar PM2
    pause
    exit /b 1
)
echo PM2 instalado correctamente.
echo.

echo [2/3] Iniciando Print Server...
cd /d C:\Users\DAVIS\pikta-print-server
pm2 delete pikta-print 2>nul
pm2 start server.js --name pikta-print
pm2 save
echo Print Server iniciado.
echo.

echo [3/3] Creando tarea de inicio automatico...
powershell -Command "$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c cd /d C:\Users\DAVIS\pikta-print-server && pm2 resurrect' -WorkingDirectory 'C:\Users\DAVIS\pikta-print-server'; $trigger = New-ScheduledTaskTrigger -AtLogon; $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; Register-ScheduledTask -TaskName 'PIKTAPrintServer' -Action $action -Trigger $trigger -Settings $settings -Force -RunLevel Highest"
if %errorlevel% neq 0 (
    echo ERROR: No se pudo crear la tarea automatica
    echo El servidor sigue corriendo pero no arrancara solo.
    pause
    exit /b 1
)
echo Tarea creada correctamente.
echo.

echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo   El Print Server arrancara SOLO cada vez
echo   que la PC se encienda.
echo.
echo   Para verificar: pm2 status
echo   Para ver logs:   pm2 logs pikta-print
echo.
pause
