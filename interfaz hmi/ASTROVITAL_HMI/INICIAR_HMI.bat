@echo off
setlocal
cd /d "%~dp0"
set "HMI_PY=py -3"
py -3 --version >nul 2>&1
if not errorlevel 1 goto python_ok
set "HMI_PY=python"
python --version >nul 2>&1
if not errorlevel 1 goto python_ok
echo Instala Python 3.9 o superior desde https://www.python.org/downloads/
echo Marca Add Python to PATH durante la instalacion.
pause
exit /b 1
:python_ok
%HMI_PY% -c "import tkinter" >nul 2>&1
if errorlevel 1 (
 echo Python necesita Tcl/Tk. Activa esa opcion al modificar la instalacion de Python.
 pause
 exit /b 1
)
%HMI_PY% -c "import serial; from serial.tools import list_ports; assert hasattr(serial, 'Serial')" >nul 2>&1
if not errorlevel 1 goto run
%HMI_PY% -m pip install -r requirements.txt
if errorlevel 1 (
 echo No se pudo instalar pyserial. Revisa la conexion a internet.
 pause
 exit /b 1
)
:run
%HMI_PY% astro_vital_hmi.py
if errorlevel 1 pause
endlocal
