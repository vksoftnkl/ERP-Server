#include "deploy_window.h"

#include <QApplication>
#include <QIcon>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    QApplication::setApplicationName(QStringLiteral("ERP Deploy Manager"));
    QApplication::setApplicationVersion(QStringLiteral(APP_VERSION));
    QApplication::setDesktopFileName(QStringLiteral("erp-deploy-manager"));
    QApplication::setWindowIcon(QIcon::fromTheme(QStringLiteral("system-software-update")));

    DeployWindow window;
    window.show();
    return app.exec();
}
