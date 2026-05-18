#include <QApplication>
#include <QIcon>
#include "mainwindow.h"

int main(int argc, char* argv[])
{
    QApplication app(argc, argv);
    app.setOrganizationName("nanamitm");
    app.setApplicationName("APuzzleADaySolverGUI");
    app.setStyle("Fusion");
    app.setWindowIcon(QIcon(":/icon.png"));

    MainWindow w;
    w.show();
    return app.exec();
}
