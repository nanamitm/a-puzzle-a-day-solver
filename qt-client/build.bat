@echo off
setlocal

set MINGW_BIN=C:\Qt\Tools\mingw1310_64\bin
set QT_DIR=C:\Qt\6.9.2\mingw_64
set RUST_RELEASE=..\target\release

:: Step 1: Build the Rust FFI library (MSVC target, default)
echo [1/3] Building Rust FFI library...
cd /d "%~dp0.."
cargo build -p solver-ffi --release
if errorlevel 1 (
    echo ERROR: Rust build failed.
    exit /b 1
)

:: Step 2: Create MinGW import library from the MSVC DLL
echo [2/3] Creating MinGW import library...
cd /d "%~dp0"
if not exist build mkdir build
%MINGW_BIN%\gendef.exe %RUST_RELEASE%\solver_ffi.dll
if errorlevel 1 ( echo ERROR: gendef failed. & exit /b 1 )
move /y solver_ffi.def build\solver_ffi.def >nul
%MINGW_BIN%\dlltool.exe -d build\solver_ffi.def -l libsolver_ffi.a --dllname solver_ffi.dll
if errorlevel 1 ( echo ERROR: dlltool failed. & exit /b 1 )

:: Step 3: Configure and build the Qt6 project
echo [3/3] Building Qt6 client...
if exist build rmdir /s /q build
mkdir build
cmake -B build -S . ^
  -G "MinGW Makefiles" ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DCMAKE_PREFIX_PATH="%QT_DIR%" ^
  -DCMAKE_CXX_COMPILER="%MINGW_BIN%\g++.exe"
if errorlevel 1 ( echo ERROR: CMake configure failed. & exit /b 1 )

cmake --build build --parallel
if errorlevel 1 ( echo ERROR: CMake build failed. & exit /b 1 )

echo.
echo Build succeeded!
echo Executable: %~dp0build\APuzzleADaySolverGUI.exe
endlocal
