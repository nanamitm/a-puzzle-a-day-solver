================================================================
 A-Puzzle-A-Day Solver  -  Qt6/C++ GUI クライアント ビルド手順
================================================================

----------------------------------------------------------------
1. 事前要件
----------------------------------------------------------------

共通
  - Rust (https://rustup.rs/)
  - Qt 6.4 以上 (Widgets コンポーネント)
  - CMake 3.16 以上
  - C++17 対応コンパイラ

Windows
  - Visual Studio 2019/2022 (MSVC) または MinGW
  - Qt インストール時に対応するコンパイラキットを選択すること
  - Qt に同梱の CMake / MinGW を使う場合はフルパス指定が必要 (後述)

Linux
  - GCC または Clang
  - Qt パッケージ (例: sudo apt install qt6-base-dev cmake)

macOS
  - Xcode Command Line Tools
  - Qt (例: brew install qt@6)

----------------------------------------------------------------
2. Windows でのビルド (MinGW)
----------------------------------------------------------------

(2-1) 初回のみ: Rust と MinGW のパスを環境変数に追加
  - Rust が PATH に含まれていない場合はターミナルを再起動するか
    %USERPROFILE%\.cargo\bin を PATH に追加する

(2-2) ビルドスクリプトを実行
  qt-client\build.bat

  ※ build.bat の先頭にある変数を環境に合わせて変更してください:
      set MINGW_BIN=C:\Qt\Tools\mingw1310_64\bin
      set QT_DIR=C:\Qt\6.9.2\mingw_64

  処理内容:
    [1/3] Rust FFI ライブラリ (solver_ffi.dll) をビルド
    [2/3] dlltool で MinGW 用インポートライブラリ (libsolver_ffi.a) を生成
    [3/3] CMake で Qt アプリをビルド

(2-3) 初回実行時は windeployqt で Qt DLL を配置する
  C:\Qt\6.9.2\mingw_64\bin\windeployqt.exe build\APuzzleADaySolverGUI.exe

(2-4) 実行
  build\APuzzleADaySolverGUI.exe

----------------------------------------------------------------
3. Linux でのビルド
----------------------------------------------------------------

(3-1) Qt6 のパスを指定 (システム標準以外の場所にある場合)
  export CMAKE_PREFIX_PATH=/path/to/Qt/6.x.x/gcc_64

(3-2) ビルドスクリプトを実行
  chmod +x qt-client/build.sh
  ./qt-client/build.sh

  処理内容:
    [1/2] Rust FFI ライブラリ (libsolver_ffi.so) をビルド
    [2/2] CMake で Qt アプリをビルド
    ※ Linux では dlltool は不要

(3-3) 実行
  build/APuzzleADaySolverGUI

  実行時に libsolver_ffi.so が見つからない場合:
    export LD_LIBRARY_PATH=../target/release:$LD_LIBRARY_PATH

----------------------------------------------------------------
4. macOS でのビルド
----------------------------------------------------------------

(4-1) Qt6 のパスを指定
  export CMAKE_PREFIX_PATH=/path/to/Qt/6.x.x/macos
  # または: export CMAKE_PREFIX_PATH=$(brew --prefix qt@6)

(4-2) ビルドスクリプトを実行
  chmod +x qt-client/build.sh
  ./qt-client/build.sh

(4-3) 実行
  build/APuzzleADaySolverGUI

----------------------------------------------------------------
5. CMake を手動で実行する場合
----------------------------------------------------------------

Windows (MinGW):
  cargo build -p solver-ffi --release
  C:\Qt\Tools\mingw1310_64\bin\gendef.exe ..\target\release\solver_ffi.dll
  C:\Qt\Tools\mingw1310_64\bin\dlltool.exe -d solver_ffi.def -l libsolver_ffi.a --dllname solver_ffi.dll
  cmake -B build -S . -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release ^
        -DCMAKE_PREFIX_PATH="C:\Qt\6.9.2\mingw_64" ^
        -DCMAKE_CXX_COMPILER="C:\Qt\Tools\mingw1310_64\bin\g++.exe"
  cmake --build build --parallel

Linux / macOS:
  cargo build -p solver-ffi --release
  cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
  cmake --build build --parallel

----------------------------------------------------------------
6. アイコンを変更する場合
----------------------------------------------------------------

  python gen_icon.py   # icon.ico / icon.png を再生成
  cmake --build build --parallel

  gen_icon.py 内の LAYOUT (セル配置) や PIECE (色) を編集して
  デザインをカスタマイズできます。

----------------------------------------------------------------
7. ファイル構成
----------------------------------------------------------------

  qt-client/
  ├── build.bat          Windows ビルドスクリプト
  ├── build.sh           Linux / macOS ビルドスクリプト
  ├── CMakeLists.txt     CMake 定義 (クロスプラットフォーム対応)
  ├── solver_ffi.h       Rust FFI C ヘッダー
  ├── main.cpp
  ├── mainwindow.h/.cpp  メインウィンドウ
  ├── boardwidget.h/.cpp 盤面描画ウィジェット
  ├── solverworker.h/.cpp QThread ソルバーワーカー
  ├── resources.qrc      Qt リソース定義
  ├── app.rc             Windows EXE アイコン (Windows のみ使用)
  ├── icon.ico           マルチサイズアイコン
  ├── icon.png           256px アイコン
  └── gen_icon.py        アイコン生成スクリプト (要 Pillow)

================================================================
