:: NOTE: This is the OUTDATED .bat file this app was made to replace. uploading as legacy support 
:: this file automates hamad's method (needs updating, but that's what the app is for). 

:: ====================================== Copyright Notice ======================================

:: This script is not an offical product of Sys-Info and was created by a customer of Private.
:: This was made to automate a temporary solution for the emulator since VG updated.
:: 
:: Automated by: @forgotmyseed (1470172610636808425) on June 6th, 2025.
:: Method Founded by: @h_amad (840878623157518346)

:: Last Updated: June 22nd, 2025
:: ==============================================================================================

@echo off
chcp 65001 >nul
title Sysinfo.gg ^| Private Automation Script
color 4


:: ============= only change the numbers below if the script is too fast or too slow ============

:: manual override paths for the files (if the script can't find them on its own)
:: leave blank to auto-search in this folder and subfolders
SET LDR_PATH=
SET EMU_PATH=

:: if val opens but closed too fast/slow then make this number bigger/smaller (its in seconds)
SET TEMP_VAL_WAIT=10

:: if sesh.exe is starting too early/late then make this number bigger/smaller (its in seconds)
SET SESH_WAIT=10

:: do NOT change these
SET CHECK_EVERY=2
SET CLOSE_WAIT=2

:: ==============================================================================================

for /f "delims=" %%a in ('powershell -NoProfile -Command "[char]27"') do set "ESC=%%a"


:menu
cls
echo %ESC%[95m %ESC%[5mNote%ESC%[90m: (%ESC%[4m%ESC%[37mThis is NOT an official product of Sys-Info%ESC%[90m)%ESC%[0m
echo.
echo.
echo %ESC%[95m^                                 ⠀⠀⢀⢴⢼⠕⠯⣳⢼⠳⠝⠷⠝⠷⢝⡦⣄⣀⢠⢤⡀⡀⠀⢀⣀⢤⢄⣀⡠⡦⡯⠞⠽⠺⠽⠺⠗⠯⣖⢦%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⡼⡝⠁⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠈⠓⡗⠋⠁⠫⣗⣖⢷⠙⠉⠑⢳⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠯⡧%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⡽⡅⠀⠀⢢⠠⡀⠀⠑⢑⢍⢪⠢⡀⠀⠀⠀⡀⠀⠀⠯⠁⠀⢀⠀⠀⠀⢠⢨⢊⢎⠪⠊⠀⢀⠰⡨⠀⠀⢸⢽%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⢯⡃⠀⠀⡑⡕⢌⠢⡀⠀⠈⠂⢇⢕⢑⠄⠀⠜⢄⠀⠀⠀⢄⠣⠀⢄⢊⢆⠕⠜⠀⠀⢀⢐⠔⡕⣑⠀⠀⢸⣝%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⢫⣳⠀⠀⠘⢌⢪⢊⢆⠢⡀⠀⠀⠑⢅⢇⢣⠹⡐⡅⡀⢌⢆⢝⠸⡘⡌⠆⠁⠀⢀⢐⢌⢆⢣⠱⠐⠀⢀⣞⠞%ESC%[0m
echo %ESC%[95m^                                 ⠀⣠⡲⡽⡵⣄⡀⠀⠑⠌⢆⢣⢊⢆⢄⠀⠀⠑⠜⡌⢎⢌⢎⠢⡃⢎⠪⠈⠀⠀⢠⢘⠔⡅⡣⡊⠂⠀⢀⡤⣞⣞⢶⢄%ESC%[0m
echo %ESC%[95m^                                 ⡮⡎⠁⠀⠀⠀⠀⠀⠀⠀⠁⠣⣑⢢⠱⡐⢄⠀⠀⠈⠪⡢⡑⢕⠱⠁⠀⠀⡠⠪⡘⡔⢕⠅⠃⠀⠀⠀⠀⠀⠀⠀⠈⢫⢧%ESC%[0m
echo %ESC%[95m^                                 ⢯⣣⡀⠀⠁⠣⡑⡕⢔⢀⠀⠀⠀⠑⢕⠱⡑⡔⡄⡀⠀⠈⠊⠊⠀⠀⡄⡣⡊⢎⢪⠘⠀⠀⠀⡀⡢⡱⡑⡅⠃⠀⢀⡼⡝%ESC%[0m
echo %ESC%[95m^                                 ⠀⠘⢞⢦⡀⠀⠁⠊⡪⢢⢑⠄⠀⠀⠈⠘⡌⢆⢣⢱⢠⠀⠀⢀⢄⢕⢜⠰⡑⠕⠁⠀⠀⡀⢆⢕⢱⠈⠀⠀⢀⡴⡳⠋%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠙⠮⣗⣄⠀⠈⠨⢢⢃⠇⡄⠀⠀⠈⠈⢆⠣⣊⠪⠀⡱⡨⡢⡱⠁⠀⠀⢀⢀⢆⠪⡊⠆⠁⠀⣠⢞⡗⠋⠀⠀%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠀⠀⠑⠳⣳⢄⠀⠀⠑⢕⠜⡌⡪⡠⡀⠀⢕⠢⢍⠀⡢⡱⡨⠀⢀⢐⠔⡌⢆⠕⠅⠁⠀⣠⣺⠚⠉%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠀⠀⠀⠀⠈⠹⡵⣢⡀⠀⠑⢘⢌⢆⢪⠠⡊⡪⠪⠀⡸⡐⢕⢐⢔⠅⡇⠎⠊⠀⢀⢴⢽⠚%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠳⣝⡦⡀⠀⠐⠅⡕⡱⢡⢃⢇⠀⡪⡘⡌⢎⠢⡣⠊⠀⢀⡴⡽⠝⠁%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⢯⢦⡀⠀⠈⠘⢌⢆⢣⠀⢪⢨⢊⠎⠀⠀⣀⣔⡗⠋%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠯⣗⣄⠀⠀⠑⢅⠀⢕⠌⠀⠀⣠⣺⠵⠃%ESC%[0m
echo %ESC%[95m^                                 ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠺⡵⣄⠀⠀⠀⠀⠀⣠⢞⠕⠁%ESC%[0m
echo %ESC%[95m^                         ⠀⠀⠀  ⠀⠀⠀            ⠀⠀⠀⠀⠀⠀⠀⠈⠺⢝⣖⡶⣲⠯⠗⠁%ESC%[0m
echo.
echo %ESC%[90m                                ╭─────────────────────────────────────────────╮%ESC%[0m
echo %ESC%[90m                                │    %ESC%[95m[%ESC%[97m1%ESC%[95m]%ESC%[92m  start process      %ESC%[95m(%ESC%[91mval restart%ESC%[95m)%ESC%[90m    │%ESC%[0m
echo %ESC%[90m                                │    %ESC%[95m[%ESC%[97m2%ESC%[95m]%ESC%[92m  start process      %ESC%[95m(%ESC%[91mno val restart%ESC%[95m)%ESC%[90m │%ESC%[0m
echo %ESC%[90m                                │    %ESC%[95m[%ESC%[97m3%ESC%[95m]%ESC%[97m  first time setup   %ESC%[95m(%ESC%[91mwith emu%ESC%[95m)%ESC%[90m       │%ESC%[0m
echo %ESC%[90m                                │    %ESC%[95m[%ESC%[97m4%ESC%[95m]%ESC%[91m  create session     %ESC%[95m(%ESC%[91mruns sesh.exe%ESC%[95m)%ESC%[90m  │%ESC%[0m
echo %ESC%[90m                                │    %ESC%[95m[%ESC%[97m5%ESC%[95m]%ESC%[91m  close val/riot%ESC%[90m                      │%ESC%[0m
echo %ESC%[90m                                │    %ESC%[95m[%ESC%[97m6%ESC%[95m]%ESC%[93m  checks for issues%ESC%[90m                   │%ESC%[0m
echo %ESC%[90m                                ├─────────────────────────────────────────────╯%ESC%[0m
set /p "choice=%ESC%[95m %ESC%[90m                               └────%ESC%[95m➤  %ESC%[97mSysInfo%ESC%[95m@%ESC%[97mOption%ESC%[95m: %ESC%[0m" <con
if "%choice%"=="1" goto :start
if "%choice%"=="2" goto :startWithSkip
if "%choice%"=="3" call :firstTime
if "%choice%"=="4" call :closeAll & goto :menu
if "%choice%"=="5" call :Checks & goto :menu
goto :menu


:firstTime
cls
call :Checks
call :checkRiot
call :runEmu
call :tempOpenVAL
call :runLDR
call :openVAL
call :waitForVAL
call :startSesh
goto :menu

:start
cls
call :checkRiot
call :changeSeed
call :tempOpenVAL
call :runLDR
call :openVAL
call :waitForVAL
call :startSesh
goto :menu

:startWithSkip
cls
call :checkRiot
call :changeSeed
call :runLDR
call :openVAL
call :waitForVAL
call :startSesh
goto :menu

:Checks
cls
call :log "checking for issues"
echo.
set ISSUES=0
set FIX_RIOT=0
call :loading "checking rdp"
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections 2>nul | findstr /i "0x0" >nul
if %errorlevel% == 0 (
    call :err "rdp is on. this breaks the emu"
    call :err "turning it off and rebooting. run again after restart"
    reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 1 /f >nul 2>&1
    set /p "tmp=press enter to reboot " <con
    shutdown /r /t 0
)
call :ok "rdp is off"
echo.
call :loading "checking vanguard"
call :checkVG
call :ok "vgc/vgk are both running"
echo.
call :loading "checking vc redist"
call :checkVC
call :ok "vc redist is installed"
echo.
call :loading "checking riot"
call :getRunningRiotPath RUNNING_RIOT_PATH
if defined RUNNING_RIOT_PATH (call :ok "riot is running") else (call :warn "riot is not running" & set /a ISSUES+=1 & set FIX_RIOT=1)
echo.
call :loading "checking emu and loader files"
set MISSING_FILE=
call :findExe "emu_installer.exe" "%EMU_PATH%" EMU_FOUND
if not defined EMU_FOUND (
    call :warn "emu not found (emu_installer.exe)"
    set /a ISSUES+=1
    set "MISSING_FILE=emu_installer.exe"
)
call :findExe "ldr.novgk.exe" "%LDR_PATH%" LDR_FOUND
if not defined LDR_FOUND (
    call :warn "loader not found (ldr.novgk.exe)"
    set /a ISSUES+=1
    if defined MISSING_FILE (set "MISSING_FILE=%MISSING_FILE% and ldr.novgk.exe") else (set "MISSING_FILE=ldr.novgk.exe")
)
if not defined MISSING_FILE call :ok "emu and loader found"
echo.
echo %ESC%[90m ─────────────────────────────────────────────%ESC%[0m
if %ISSUES% == 0 (
    call :ok "all good"
    echo.
    set /p "tmp=press enter to go back " <con
    exit /b
)
call :warn "%ISSUES% issue(s) found"
echo.
if %FIX_RIOT%==0 if defined MISSING_FILE (
    call :err "put %ESC%[4m%MISSING_FILE%%ESC%[0m in the same folder as this .bat file then run checks again"
    echo.
    set /p "tmp=press enter to go back " <con
    exit /b
)
set /p "fix=%ESC%[95m fix issues? [y/n] > %ESC%[0m" <con
if /i not "%fix%"=="y" (
    echo.
    set /p "tmp=press enter to go back " <con
    exit /b
)
echo.
if %FIX_RIOT%==1 (
    call :loading "starting riot client"
    call :checkRiot
    call :ok "riot is running"
    echo.
)
if defined MISSING_FILE (
    call :err "%ESC%[4m%MISSING_FILE%%ESC%[0m can't be auto-fixed. put it in the same folder as this .bat file"
    echo.
) else (
    call :ok "all issues fixed"
)
echo.
set /p "tmp=press enter to go back " <con
exit /b

:runEmu
call :findExe "emu_installer.exe" "%EMU_PATH%" EMU_FOUND
if not defined EMU_FOUND (
    call :err "emu not found (emu_installer.exe)"
    exit /b
)
call :log "running emu"
powershell -Command "Start-Process -FilePath '%EMU_FOUND%' -Verb RunAs -Wait"
exit /b

:findExe
setlocal enabledelayedexpansion
set "result="
if not "%~2"=="" if exist "%~dp0%~2" set "result=%~dp0%~2"
if not defined result (
    for /f "delims=" %%f in ('dir /b /s "%~dp0%~1" 2^>nul') do if not defined result set "result=%%f"
)
endlocal & set "%~3=%result%"
exit /b

:getRunningRiotPath
setlocal enabledelayedexpansion
set "result="
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Process RiotClientServices -ErrorAction SilentlyContinue).Path | Select-Object -First 1"') do set "result=%%i"
endlocal & set "%~1=%result%"
exit /b

:findRiotInstallPath
setlocal enabledelayedexpansion
set "riotPath=%~1"
if defined riotPath if not exist "!riotPath!" set "riotPath="
if not defined riotPath (
    for /f "delims=" %%i in ('powershell -NoProfile -Command "try { (Get-Content \"$env:ProgramData\Riot Games\RiotClientInstalls.json\" -Raw | ConvertFrom-Json).rc_default } catch {}"') do set "riotPath=%%i"
    if defined riotPath if not exist "!riotPath!" set "riotPath="
)
if not defined riotPath (
    for %%d in (C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
        if not defined riotPath if exist "%%d:\Riot Games\Riot Client\RiotClientServices.exe" set "riotPath=%%d:\Riot Games\Riot Client\RiotClientServices.exe"
        if not defined riotPath if exist "%%d:\Program Files\Riot Games\Riot Client\RiotClientServices.exe" set "riotPath=%%d:\Program Files\Riot Games\Riot Client\RiotClientServices.exe"
    )
)
if not defined riotPath (
    call :warn "couldn't find riot client automatically"
    set /p "riotPath=%ESC%[95m paste full path to RiotClientServices.exe > %ESC%[0m" <con
    if not exist "!riotPath!" (
        call :err "that path doesn't exist"
        set "riotPath="
    )
)
endlocal & set "%~2=%riotPath%"
exit /b

:checkRiot
call :log "looking for riot client"
setlocal enabledelayedexpansion
call :getRunningRiotPath RIOT_PATH
if not defined RIOT_PATH (
    call :findRiotInstallPath "" riotInstallPath
    if not defined riotInstallPath (
        call :err "cant find riot client"
        endlocal
        exit /b 1
    )
    call :log "launching !riotInstallPath!"
    start "" "!riotInstallPath!"
    call :waitForRiotClient
    if not defined RIOT_PATH (
        call :err "could not open riot client"
        endlocal
        exit /b 1
    )
)
endlocal & set "RIOT_PATH=%RIOT_PATH%"
exit /b 0

:waitForRiotClient
set RIOT_WAIT=0
:RIOT_WAIT_LOOP
call :getRunningRiotPath RIOT_PATH
if defined RIOT_PATH (
    exit /b
)
if %RIOT_WAIT% geq 30 exit /b
timeout /t 2 /nobreak >nul
set /a RIOT_WAIT+=1
goto :RIOT_WAIT_LOOP

:changeSeed
call :log "changing emu seed"
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -Command [Environment]::SetEnvironmentVariable(''EMU_SEED'', (Get-Random -Minimum 1 -Maximum 4294967295).ToString(), ''Machine'')' -Verb RunAs"
exit /b

:checkVG
sc start vgc >nul 2>&1
sc start vgk >nul 2>&1
powershell -NoProfile -Command "while ((Get-Service vgc -ErrorAction SilentlyContinue).Status -ne 'Running' -or (Get-Service vgk -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Sleep -Seconds 2 }"
exit /b

:checkVC
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Installed >nul 2>&1
if %errorlevel% == 0 exit /b
call :warn "vc redist not installed. downloading it now"
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://aka.ms/vc14/vc_redist.x64.exe' -OutFile '$env:TEMP\vc_redist.x64.exe'" >nul 2>&1
call :log "press enter to install"
set /p "tmp=" <con
call :log "installing vc redist"
start /wait "%TEMP%\vc_redist.x64.exe" /install /quiet /norestart
exit /b

:tempOpenVAL
call :log "temp opening val"
call :startVAL
call :waitForVAL
timeout /t %TEMP_VAL_WAIT% /nobreak >nul
call :warn "closing val"
taskkill /f /fi "IMAGENAME eq VALORANT*" >nul 2>&1
timeout /t %CLOSE_WAIT% /nobreak >nul
exit /b

:runLDR
call :findExe "ldr.novgk.exe" "%LDR_PATH%" LDR_FOUND
if not defined LDR_FOUND (
    call :err "loader not found (ldr.novgk.exe)"
    exit /b
)
call :log "running ldr"
powershell -Command "Start-Process -FilePath '%LDR_FOUND%' -Verb RunAs"
exit /b

:openVAL
call :log "opening val"
call :startVAL
exit /b

:startVAL
start "" "%RIOT_PATH%" --launch-product=valorant --launch-patchline=live
set _SV_POLL=0
:_SV_POLL_LOOP
call :isValRunning
if %errorlevel% == 0 exit /b
if %_SV_POLL% geq 5 goto :useAPI
timeout /t 1 /nobreak >nul
set /a _SV_POLL+=1
goto :_SV_POLL_LOOP

:: this just uses the riot client api to open valorant if the direct method fails for some reason.
:useAPI
powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand JABsAG8AYwBrAFAAYQB0AGgAIAA9ACAAIgAkAGUAbgB2ADoATABPAEMAQQBMAEEAUABQAEQAQQBUAEEAXABSAGkAbwB0ACAARwBhAG0AZQBzAFwAUgBpAG8AdAAgAEMAbABpAGUAbgB0AFwAQwBvAG4AZgBpAGcAXABsAG8AYwBrAGYAaQBsAGUAIgAKAGkAZgAgACgALQBuAG8AdAAgACgAVABlAHMAdAAtAFAAYQB0AGgAIAAkAGwAbwBjAGsAUABhAHQAaAApACkAIAB7AAoAIAAgACAAIABXAHIAaQB0AGUALQBPAHUAdABwAHUAdAAgACIAZgBhAGkAbABlAGQAIAB0AG8AIABvAHAAZQBuACAAdgBhAGwAIgAKACAAIAAgACAAZQB4AGkAdAAgADEACgB9AAoACgAkAHAAYQByAHQAcwAgAD0AIAAoAEcAZQB0AC0AQwBvAG4AdABlAG4AdAAgACQAbABvAGMAawBQAGEAdABoACkAIAAtAHMAcABsAGkAdAAgACcAOgAnAAoAJABwAG8AcgB0ACAAPQAgACQAcABhAHIAdABzAFsAMgBdAAoAJABwAGEAcwBzACAAPQAgACQAcABhAHIAdABzAFsAMwBdAAoACgAkAGEAdQB0AGgAIAA9ACAAWwBDAG8AbgB2AGUAcgB0AF0AOgA6AFQAbwBCAGEAcwBlADYANABTAHQAcgBpAG4AZwAoAFsAVABlAHgAdAAuAEUAbgBjAG8AZABpAG4AZwBdADoAOgBBAFMAQwBJAEkALgBHAGUAdABCAHkAdABlAHMAKAAiAHIAaQBvAHQAOgAkAHAAYQBzAHMAIgApACkACgBbAFMAeQBzAHQAZQBtAC4ATgBlAHQALgBTAGUAcgB2AGkAYwBlAFAAbwBpAG4AdABNAGEAbgBhAGcAZQByAF0AOgA6AFMAZQBjAHUAcgBpAHQAeQBQAHIAbwB0AG8AYwBvAGwAIAA9ACAAWwBTAHkAcwB0AGUAbQAuAE4AZQB0AC4AUwBlAGMAdQByAGkAdAB5AFAAcgBvAHQAbwBjAG8AbABUAHkAcABlAF0AOgA6AFQAbABzADEAMgAKAAoAaQBmACAAKAAtAG4AbwB0ACAAKABbAFMAeQBzAHQAZQBtAC4ATQBhAG4AYQBnAGUAbQBlAG4AdAAuAEEAdQB0AG8AbQBhAHQAaQBvAG4ALgBQAFMAVAB5AHAAZQBOAGEAbQBlAF0AJwBUAHIAdQBzAHQAQQBsAGwAQwBlAHIAdABzAFAAbwBsAGkAYwB5ACcAKQAuAFQAeQBwAGUAKQAgAHsACgAgACAAIAAgAEEAZABkAC0AVAB5AHAAZQAgAEAAIgAKAHUAcwBpAG4AZwAgAFMAeQBzAHQAZQBtAC4ATgBlAHQAOwAKAHUAcwBpAG4AZwAgAFMAeQBzAHQAZQBtAC4ATgBlAHQALgBTAGUAYwB1AHIAaQB0AHkAOwAKAHUAcwBpAG4AZwAgAFMAeQBzAHQAZQBtAC4AUwBlAGMAdQByAGkAdAB5AC4AQwByAHkAcAB0AG8AZwByAGEAcABoAHkALgBYADUAMAA5AEMAZQByAHQAaQBmAGkAYwBhAHQAZQBzADsACgBwAHUAYgBsAGkAYwAgAGMAbABhAHMAcwAgAFQAcgB1AHMAdABBAGwAbABDAGUAcgB0AHMAUABvAGwAaQBjAHkAIAA6ACAASQBDAGUAcgB0AGkAZgBpAGMAYQB0AGUAUABvAGwAaQBjAHkAIAB7AAoAIAAgACAAIABwAHUAYgBsAGkAYwAgAGIAbwBvAGwAIABDAGgAZQBjAGsAVgBhAGwAaQBkAGEAdABpAG8AbgBSAGUAcwB1AGwAdAAoAFMAZQByAHYAaQBjAGUAUABvAGkAbgB0ACAAcwBwACwAIABYADUAMAA5AEMAZQByAHQAaQBmAGkAYwBhAHQAZQAgAGMAZQByAHQALAAgAFcAZQBiAFIAZQBxAHUAZQBzAHQAIAByAGUAcQAsACAAaQBuAHQAIABwAHIAbwBiAGwAZQBtACkAIAB7AAoAIAAgACAAIAAgACAAIAAgAHIAZQB0AHUAcgBuACAAdAByAHUAZQA7AAoAIAAgACAAIAB9AAoAfQAKACIAQAAKAH0ACgBbAFMAeQBzAHQAZQBtAC4ATgBlAHQALgBTAGUAcgB2AGkAYwBlAFAAbwBpAG4AdABNAGEAbgBhAGcAZQByAF0AOgA6AEMAZQByAHQAaQBmAGkAYwBhAHQAZQBQAG8AbABpAGMAeQAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAVAByAHUAcwB0AEEAbABsAEMAZQByAHQAcwBQAG8AbABpAGMAeQAKAAoAdAByAHkAIAB7AAoAIAAgACAAIABJAG4AdgBvAGsAZQAtAFIAZQBzAHQATQBlAHQAaABvAGQAIAAtAE0AZQB0AGgAbwBkACAAUABvAHMAdAAgAC0AVQByAGkAIAAiAGgAdAB0AHAAcwA6AC8ALwAxADIANwAuADAALgAwAC4AMQA6ACQAcABvAHIAdAAvAHAAcgBvAGQAdQBjAHQALQBsAGEAdQBuAGMAaABlAHIALwB2ADEALwBwAHIAbwBkAHUAYwB0AHMALwB2AGEAbABvAHIAYQBuAHQALwBwAGEAdABjAGgAbABpAG4AZQBzAC8AbABpAHYAZQAiACAALQBIAGUAYQBkAGUAcgBzACAAQAB7ACAAQQB1AHQAaABvAHIAaQB6AGEAdABpAG8AbgAgAD0AIAAiAEIAYQBzAGkAYwAgACQAYQB1AHQAaAAiACAAfQAgAC0ARQByAHIAbwByAEEAYwB0AGkAbwBuACAAUwB0AG8AcAAgAHwAIABPAHUAdAAtAE4AdQBsAGwACgB9ACAAYwBhAHQAYwBoACAAewAKACAAIAAgACAAVwByAGkAdABlAC0ATwB1AHQAcAB1AHQAIAAiAGYAYQBpAGwAZQBkACAAdABvACAAbwBwAGUAbgAgAHYAYQBsACIACgAgACAAIAAgAGUAeABpAHQAIAAxAAoAfQA=

exit /b

:waitForVAL
call :loading "waiting for val"
:_WFV_POLL
call :isValRunning
if %errorlevel% neq 0 ( timeout /t %CHECK_EVERY% /nobreak >nul && goto :_WFV_POLL)
call :ok "val found"
exit /b

:isValRunning
tasklist 2>nul | findstr /i "VALORANT" >nul
exit /b %errorlevel%

:startSesh
timeout /t %SESH_WAIT% /nobreak >nul
call :log "starting sesh"
if exist "%~dp0tracex\sesh.exe" ( start "" "%~dp0tracex\sesh.exe") else ( start "" "%~dp0sesh.exe")
call :done
exit /b

:closeAll
taskkill /f /fi "IMAGENAME eq VALORANT*" >nul 2>&1
taskkill /f /fi "IMAGENAME eq RiotClientServices.exe" >nul
taskkill /f /fi "IMAGENAME eq sesh.exe" >nul 2>&1
taskkill /f /fi "IMAGENAME eq ldr.novgk.exe" >nul 2>&1
:done
sexit /b


:log
echo %ESC%[95m[%ESC%[97m*%ESC%[95m] %~1%ESC%[0m
exit /b

:loading
echo %ESC%[95m[%ESC%[97m*%ESC%[95m]%ESC%[97m %~1%ESC%[0m
exit /b

:ok
echo %ESC%[95m[%ESC%[97m+%ESC%[95m]%ESC%[92m %~1%ESC%[0m
exit /b

:warn
echo %ESC%[95m[%ESC%[97m*%ESC%[95m]%ESC%[91m %~1%ESC%[0m
exit /b

:err
echo %ESC%[95m[%ESC%[97m!%ESC%[95m]%ESC%[91m %~1%ESC%[0m
exit /b

:done
echo %ESC%[95m[%ESC%[97m+%ESC%[95m]%ESC%[1;92m ready%ESC%[0m
timeout /t 3 /nobreak >nul
exit /b
