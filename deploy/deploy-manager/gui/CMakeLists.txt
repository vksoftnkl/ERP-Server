cmake_minimum_required(VERSION 3.21)
project(ErpDeployManager VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# The installed binary finds the Qt it was built against (e.g. ~/Qt/6.12.0).
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Widgets)
qt_standard_project_setup()

qt_add_executable(erp-deploy-manager
    main.cpp
    deploy_window.cpp
    deploy_window.h
)
target_link_libraries(erp-deploy-manager PRIVATE Qt6::Widgets)
target_compile_definitions(erp-deploy-manager PRIVATE APP_VERSION="${PROJECT_VERSION}")

install(TARGETS erp-deploy-manager RUNTIME DESTINATION .)
install(PROGRAMS ../erp-deploy.sh DESTINATION .)
