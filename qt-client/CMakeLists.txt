cmake_minimum_required(VERSION 3.16)
project(APuzzleADaySolverGUI LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Widgets)

set(RUST_TARGET_DIR "${CMAKE_SOURCE_DIR}/../target/release")

set(APP_SOURCES
    main.cpp
    solver_ffi.h
    boardwidget.h  boardwidget.cpp
    solverworker.h solverworker.cpp
    mainwindow.h   mainwindow.cpp
    resources.qrc
)

# Windows: embed the exe icon via a resource script
if(WIN32)
    list(APPEND APP_SOURCES app.rc)
endif()

qt_add_executable(APuzzleADaySolverGUI WIN32 ${APP_SOURCES})

target_include_directories(APuzzleADaySolverGUI PRIVATE ${CMAKE_SOURCE_DIR})

# ── Link against the Rust FFI shared library ───────────────────────────────
if(WIN32)
    if(MSVC)
        set(SOLVER_FFI_IMPORT_LIB "${RUST_TARGET_DIR}/solver_ffi.dll.lib")
    else()
        # MinGW build: link against the dlltool-generated import library.
        # Run build.bat (or the dlltool commands manually) to create libsolver_ffi.a
        # before invoking cmake --build.
        set(SOLVER_FFI_IMPORT_LIB "${CMAKE_SOURCE_DIR}/libsolver_ffi.a")
    endif()
    target_link_libraries(APuzzleADaySolverGUI PRIVATE
        Qt6::Widgets
        "${SOLVER_FFI_IMPORT_LIB}"
    )
    set(SOLVER_FFI_SHARED "${RUST_TARGET_DIR}/solver_ffi.dll")

elseif(APPLE)
    target_link_libraries(APuzzleADaySolverGUI PRIVATE
        Qt6::Widgets
        "${RUST_TARGET_DIR}/libsolver_ffi.dylib"
    )
    set(SOLVER_FFI_SHARED "${RUST_TARGET_DIR}/libsolver_ffi.dylib")
    # Let the exe find the dylib in its own directory at runtime
    set_target_properties(APuzzleADaySolverGUI PROPERTIES
        INSTALL_RPATH "@executable_path"
        BUILD_WITH_INSTALL_RPATH ON
    )

else()
    # Linux
    target_link_libraries(APuzzleADaySolverGUI PRIVATE
        Qt6::Widgets
        "${RUST_TARGET_DIR}/libsolver_ffi.so"
    )
    set(SOLVER_FFI_SHARED "${RUST_TARGET_DIR}/libsolver_ffi.so")
    # Let the exe find the .so in its own directory at runtime
    set_target_properties(APuzzleADaySolverGUI PROPERTIES
        INSTALL_RPATH "$ORIGIN"
        BUILD_WITH_INSTALL_RPATH ON
    )
endif()

# Copy the shared library next to the executable after each build
add_custom_command(TARGET APuzzleADaySolverGUI POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${SOLVER_FFI_SHARED}"
        $<TARGET_FILE_DIR:APuzzleADaySolverGUI>
)
