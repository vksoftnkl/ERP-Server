#include "deploy_window.h"

#include <QApplication>
#include <QCheckBox>
#include <QCloseEvent>
#include <QComboBox>
#include <QDesktopServices>
#include <QDir>
#include <QFileInfo>
#include <QFontDatabase>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QLabel>
#include <QListWidget>
#include <QMessageBox>
#include <QPainter>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSplitter>
#include <QStatusBar>
#include <QTreeWidget>
#include <QUrl>
#include <QVBoxLayout>

#include <csignal>
#include <unistd.h>

namespace {

const QColor kGrey(165, 165, 165);
const QColor kBlue(35, 115, 215);
const QColor kGreen(35, 150, 65);
const QColor kRed(205, 45, 45);
const QColor kOrange(225, 135, 15);

QIcon dotIcon(const QColor &color)
{
    QPixmap pixmap(14, 14);
    pixmap.fill(Qt::transparent);
    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setPen(Qt::NoPen);
    painter.setBrush(color);
    painter.drawEllipse(1, 1, 12, 12);
    return QIcon(pixmap);
}

QString dot(const QColor &color)
{
    return QStringLiteral("<span style=\"color:%1\">&#9679;</span>").arg(color.name());
}

QString shortHash(const QString &hash) { return hash.left(8); }

} // namespace

DeployWindow::DeployWindow(QWidget *parent)
    : QMainWindow(parent)
{
    const QString fromEnv = qEnvironmentVariable("ERP_DEPLOY_ENGINE");
    m_engine = !fromEnv.isEmpty()
        ? fromEnv
        : QDir(QCoreApplication::applicationDirPath()).filePath(QStringLiteral("erp-deploy.sh"));

    buildUi();

    if (!QFileInfo(m_engine).isFile()) {
        appendLog(tr("The deploy script was not found: %1").arg(m_engine));
        m_serverLabel->setText(dot(kRed) + tr(" The deploy script is missing. Reinstall ERP Deploy Manager."));
        updateButtons();
        return;
    }
    refreshStatus();
}

void DeployWindow::buildUi()
{
    setWindowTitle(tr("ERP Deploy Manager"));
    resize(1080, 800);

    auto *central = new QWidget(this);
    auto *root = new QVBoxLayout(central);

    // --- What runs now
    auto *serverBox = new QGroupBox(tr("Server"), central);
    auto *serverForm = new QFormLayout(serverBox);
    m_serverLabel = new QLabel(tr("Reading…"), serverBox);
    m_deployedLabel = new QLabel(serverBox);
    m_databaseLabel = new QLabel(serverBox);
    for (QLabel *label : {m_serverLabel, m_deployedLabel, m_databaseLabel}) {
        label->setTextInteractionFlags(Qt::TextSelectableByMouse);
        label->setWordWrap(true);
    }
    serverForm->addRow(tr("Status:"), m_serverLabel);
    serverForm->addRow(tr("Running version:"), m_deployedLabel);
    serverForm->addRow(tr("Database:"), m_databaseLabel);
    root->addWidget(serverBox);

    // --- What is new on GitHub
    auto *updateBox = new QGroupBox(tr("Updates from GitHub"), central);
    auto *updateLayout = new QVBoxLayout(updateBox);
    auto *branchRow = new QHBoxLayout;
    branchRow->addWidget(new QLabel(tr("Branch:"), updateBox));
    m_branchBox = new QComboBox(updateBox);
    m_branchBox->setMinimumWidth(240);
    branchRow->addWidget(m_branchBox);
    m_checkButton = new QPushButton(tr("Check for updates"), updateBox);
    m_checkButton->setIcon(QIcon::fromTheme(QStringLiteral("view-refresh")));
    branchRow->addWidget(m_checkButton);
    branchRow->addStretch();
    updateLayout->addLayout(branchRow);

    m_remoteLabel = new QLabel(tr("Click “Check for updates” to see what is new on GitHub."), updateBox);
    m_remoteLabel->setWordWrap(true);
    m_remoteLabel->setTextInteractionFlags(Qt::TextSelectableByMouse);
    updateLayout->addWidget(m_remoteLabel);

    m_blockedLabel = new QLabel(updateBox);
    m_blockedLabel->setWordWrap(true);
    m_blockedLabel->setStyleSheet(QStringLiteral(
        "QLabel { background:#fdecea; color:#8a1c1c; border:1px solid #e3a0a0; border-radius:4px; padding:6px; }"));
    m_blockedLabel->hide();
    updateLayout->addWidget(m_blockedLabel);

    auto *actionRow = new QHBoxLayout;
    m_deployButton = new QPushButton(tr("Update server"), updateBox);
    m_deployButton->setIcon(QIcon::fromTheme(QStringLiteral("system-software-update")));
    QFont bold = m_deployButton->font();
    bold.setBold(true);
    m_deployButton->setFont(bold);
    actionRow->addWidget(m_deployButton);
    m_buildOnlyBox = new QCheckBox(tr("Build only (test the build, don't touch the server)"), updateBox);
    actionRow->addWidget(m_buildOnlyBox);
    actionRow->addStretch();
    m_rollbackButton = new QPushButton(tr("Roll back…"), updateBox);
    m_rollbackButton->setIcon(QIcon::fromTheme(QStringLiteral("edit-undo")));
    actionRow->addWidget(m_rollbackButton);
    m_logsButton = new QPushButton(tr("Open logs folder"), updateBox);
    m_logsButton->setIcon(QIcon::fromTheme(QStringLiteral("folder-open")));
    actionRow->addWidget(m_logsButton);
    m_cancelButton = new QPushButton(tr("Cancel"), updateBox);
    m_cancelButton->setIcon(QIcon::fromTheme(QStringLiteral("process-stop")));
    actionRow->addWidget(m_cancelButton);
    updateLayout->addLayout(actionRow);
    root->addWidget(updateBox);

    // --- Changes, steps and log
    auto *splitter = new QSplitter(Qt::Vertical, central);
    m_changes = new QTreeWidget(splitter);
    m_changes->setHeaderLabels({tr("Change"), tr("Date"), tr("Author")});
    m_changes->header()->setSectionResizeMode(0, QHeaderView::Stretch);
    m_changes->header()->setSectionResizeMode(1, QHeaderView::ResizeToContents);
    m_changes->header()->setSectionResizeMode(2, QHeaderView::ResizeToContents);
    m_changes->setRootIsDecorated(true);
    m_changes->setUniformRowHeights(true);

    auto *bottom = new QSplitter(Qt::Horizontal, splitter);
    m_steps = new QListWidget(bottom);
    m_steps->setMinimumWidth(300);
    m_log = new QPlainTextEdit(bottom);
    m_log->setReadOnly(true);
    m_log->setMaximumBlockCount(20000);
    m_log->setLineWrapMode(QPlainTextEdit::NoWrap);
    m_log->setFont(QFontDatabase::systemFont(QFontDatabase::FixedFont));
    bottom->setStretchFactor(0, 1);
    bottom->setStretchFactor(1, 3);
    splitter->setStretchFactor(0, 2);
    splitter->setStretchFactor(1, 3);
    root->addWidget(splitter, 1);

    setCentralWidget(central);
    statusBar()->showMessage(tr("Ready"));

    connect(m_checkButton, &QPushButton::clicked, this, &DeployWindow::checkForUpdates);
    connect(m_deployButton, &QPushButton::clicked, this, &DeployWindow::startDeploy);
    connect(m_rollbackButton, &QPushButton::clicked, this, &DeployWindow::startRollback);
    connect(m_cancelButton, &QPushButton::clicked, this, &DeployWindow::cancelJob);
    connect(m_logsButton, &QPushButton::clicked, this, &DeployWindow::openLogs);
    connect(m_buildOnlyBox, &QCheckBox::toggled, this, [this](bool on) {
        m_deployButton->setText(on ? tr("Build only") : tr("Update server"));
        updateButtons();
    });
    connect(m_branchBox, &QComboBox::currentTextChanged, this, [this](const QString &text) {
        if (m_checked && text != m_checkedBranch) {
            m_checked = false;
            m_remoteLabel->setText(tr("Branch changed: click “Check for updates” for “%1”.").arg(text));
            m_changes->clear();
            m_blockedLabel->hide();
        }
        updateButtons();
    });
    updateButtons();
}

QString DeployWindow::branch() const { return m_branchBox->currentText().trimmed(); }

// ---------------------------------------------------------------- engine --

void DeployWindow::runEngine(Job job, const QStringList &args)
{
    if (m_process)
        return;
    m_job = job;
    m_buffer.clear();
    m_cancelRequested = false;
    m_critical = false;
    m_result.clear();
    m_lastFailure.clear();
    m_lastFailedStep = 0;
    m_jobInfo.clear();
    if (job == Job::Status || job == Job::Check) {
        m_info.clear();
        m_blocked.clear();
        m_commits.clear();
        m_pending.clear();
        m_extra.clear();
    }
    if (job == Job::Branches)
        m_branches.clear();

    m_process = new QProcess(this);
    m_process->setProcessChannelMode(QProcess::MergedChannels);
    // Own process group, so Cancel can stop the script together with git/npm.
    m_process->setChildProcessModifier([] { ::setsid(); });
    connect(m_process, &QProcess::readyReadStandardOutput, this, &DeployWindow::readOutput);
    connect(m_process, &QProcess::finished, this, &DeployWindow::jobFinished);
    connect(m_process, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
        if (error == QProcess::FailedToStart) {
            appendLog(tr("Could not start %1: %2").arg(m_engine, m_process->errorString()));
            m_process->deleteLater();
            m_process = nullptr;
            m_job = Job::None;
            updateButtons();
        }
    });

    if (job == Job::Deploy || job == Job::Rollback) {
        appendLog(QString());
        appendLog(QStringLiteral("────────────────────────────────────────────────────────────"));
    }
    if (job != Job::Status && job != Job::Branches)
        appendLog(QStringLiteral("$ erp-deploy.sh %1").arg(args.join(QLatin1Char(' '))));

    const QMap<Job, QString> busyText{
        {Job::Status, tr("Reading the server status…")},
        {Job::Check, tr("Fetching “%1” from GitHub…").arg(branch())},
        {Job::Branches, tr("Reading branches from GitHub…")},
        {Job::Deploy, tr("Updating the server…")},
        {Job::Rollback, tr("Rolling back…")},
    };
    statusBar()->showMessage(busyText.value(job));
    m_process->start(QStringLiteral("/bin/bash"), QStringList{m_engine} + args);
    updateButtons();
}

void DeployWindow::readOutput()
{
    if (!m_process)
        return;
    m_buffer += m_process->readAllStandardOutput();
    qsizetype newline;
    while ((newline = m_buffer.indexOf('\n')) >= 0) {
        const QString line = QString::fromUtf8(m_buffer.left(newline)).remove(QLatin1Char('\r'));
        m_buffer.remove(0, newline + 1);
        handleLine(line);
    }
}

void DeployWindow::handleLine(const QString &line)
{
    if (!line.startsWith(QLatin1String("::"))) {
        if (m_job != Job::Status && m_job != Job::Branches)
            appendLog(line);
        return;
    }
    const qsizetype space = line.indexOf(QLatin1Char(' '));
    const QString tag = line.mid(2, space < 0 ? -1 : space - 2);
    const QString rest = space < 0 ? QString() : line.mid(space + 1);
    const auto numberAndText = [&rest](int &number) {
        const qsizetype sp = rest.indexOf(QLatin1Char(' '));
        number = rest.left(sp < 0 ? rest.size() : sp).toInt();
        return sp < 0 ? QString() : rest.mid(sp + 1);
    };

    if (tag == QLatin1String("info")) {
        const qsizetype eq = rest.indexOf(QLatin1Char('='));
        if (eq > 0) {
            if (m_job == Job::Deploy || m_job == Job::Rollback)
                m_jobInfo.insert(rest.left(eq), rest.mid(eq + 1));
            else
                m_info.insert(rest.left(eq), rest.mid(eq + 1));
        }
    } else if (tag == QLatin1String("commit")) {
        m_commits << rest;
    } else if (tag == QLatin1String("migration")) {
        if (rest.startsWith(QLatin1String("pending ")))
            m_pending << rest.mid(8);
        else if (rest.startsWith(QLatin1String("extra ")))
            m_extra << rest.mid(6);
    } else if (tag == QLatin1String("blocked")) {
        m_blocked << rest;
    } else if (tag == QLatin1String("branch")) {
        m_branches << rest;
    } else if (tag == QLatin1String("plan")) {
        resetSteps(rest.split(QLatin1Char('|')));
    } else if (tag == QLatin1String("step")) {
        setStepState(rest.toInt(), StepState::Running);
    } else if (tag == QLatin1String("done")) {
        int n = 0;
        const QString detail = numberAndText(n);
        setStepState(n, StepState::Done, detail);
    } else if (tag == QLatin1String("skip")) {
        int n = 0;
        const QString detail = numberAndText(n);
        setStepState(n, StepState::Skipped, detail);
    } else if (tag == QLatin1String("fail")) {
        int n = 0;
        m_lastFailure = numberAndText(n);
        m_lastFailedStep = n;
        if (n > 0)
            setStepState(n, StepState::Failed, m_lastFailure);
        appendLog(QStringLiteral("✖ ") + m_lastFailure);
    } else if (tag == QLatin1String("critical")) {
        m_critical = (rest == QLatin1String("on"));
        if (m_critical)
            statusBar()->showMessage(tr("Updating the server — do not turn off the PC…"));
        updateButtons();
    } else if (tag == QLatin1String("recovering")) {
        statusBar()->showMessage(tr("The update failed — putting the previous version back…"));
    } else if (tag == QLatin1String("result")) {
        m_result = rest;
    }
}

void DeployWindow::jobFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    Q_UNUSED(exitStatus);
    readOutput();
    if (!m_buffer.isEmpty()) {
        handleLine(QString::fromUtf8(m_buffer));
        m_buffer.clear();
    }
    const Job job = m_job;
    m_process->deleteLater();
    m_process = nullptr;
    m_job = Job::None;
    m_critical = false;
    statusBar()->showMessage(tr("Ready"));

    switch (job) {
    case Job::Status:
        renderStatus(false);
        if (m_firstStatus) {
            m_firstStatus = false;
            loadBranches();
            return;
        }
        break;
    case Job::Check:
        renderStatus(true);
        break;
    case Job::Branches: {
        const QString keep = branch().isEmpty() ? m_info.value(QStringLiteral("config_branch")) : branch();
        if (!m_branches.isEmpty()) {
            const QSignalBlocker blocker(m_branchBox);
            m_branchBox->clear();
            m_branchBox->addItems(m_branches);
            const int index = m_branchBox->findText(keep);
            m_branchBox->setCurrentIndex(index >= 0 ? index : 0);
        } else {
            appendLog(tr("Could not read the branch list from GitHub (offline?)."));
        }
        break;
    }
    case Job::Deploy:
    case Job::Rollback:
        showJobResult(job, exitCode);
        refreshStatus();
        return;
    case Job::None:
        break;
    }
    updateButtons();
}

// --------------------------------------------------------------- actions --

void DeployWindow::refreshStatus()
{
    QStringList args{QStringLiteral("status"), QStringLiteral("--no-fetch")};
    if (!branch().isEmpty())
        args << QStringLiteral("--branch") << branch();
    runEngine(Job::Status, args);
}

void DeployWindow::loadBranches() { runEngine(Job::Branches, {QStringLiteral("branches")}); }

void DeployWindow::checkForUpdates()
{
    if (branch().isEmpty())
        return;
    runEngine(Job::Check, {QStringLiteral("status"), QStringLiteral("--branch"), branch()});
}

void DeployWindow::startDeploy()
{
    const bool buildOnly = m_buildOnlyBox->isChecked();
    const QString target = QStringLiteral("%1 @ %2").arg(branch(), shortHash(m_info.value(QStringLiteral("remote_commit"))));
    QString text;
    if (buildOnly) {
        text = tr("Build %1 as a test?\n\nThe exe is built in the deploy folder. The server, the database and "
                  "the installed exe are not touched.").arg(target);
    } else {
        if (m_info.value(QStringLiteral("up_to_date")) == QLatin1String("yes"))
            text = tr("The server already runs this version. Rebuild and install it again anyway?\n\n");
        text += tr("Update the server to %1?\n\n"
                   "1. Build the new exe (a few minutes; the server keeps running)\n"
                   "2. Stop the server (clients are cut off for about 20–60 seconds)\n"
                   "3. Back up database %2\n"
                   "4. Apply %3 new migration(s)\n"
                   "5. Install the new exe and start it\n\n"
                   "If anything fails after the server stops, the previous exe and database are put back "
                   "automatically.")
                    .arg(target, m_info.value(QStringLiteral("db_name")))
                    .arg(m_pending.size());
    }
    if (QMessageBox::question(this, buildOnly ? tr("Build only") : tr("Update server"), text,
                              QMessageBox::Yes | QMessageBox::Cancel, QMessageBox::Cancel)
        != QMessageBox::Yes)
        return;

    m_buildOnlyRun = buildOnly;
    QStringList args{QStringLiteral("deploy"), QStringLiteral("--branch"), branch()};
    if (buildOnly)
        args << QStringLiteral("--build-only");
    runEngine(Job::Deploy, args);
}

void DeployWindow::startRollback()
{
    const QString prevCommit = m_info.value(QStringLiteral("prev_commit"));
    const QString prevSubject = m_info.value(QStringLiteral("prev_subject"));
    const QString previous = prevCommit.isEmpty()
        ? (prevSubject.isEmpty() ? tr("the exe that ran before the last update") : prevSubject)
        : QStringLiteral("%1 @ %2 — %3").arg(m_info.value(QStringLiteral("prev_branch")), shortHash(prevCommit), prevSubject);
    const QString backup = m_info.value(QStringLiteral("last_backup"));
    const int applied = m_info.value(QStringLiteral("last_migrations_applied")).toInt();

    QMessageBox box(QMessageBox::Question, tr("Roll back"), tr("Go back to the previous version?"),
                    QMessageBox::NoButton, this);
    QString details = tr("Previous version: %1\n\nThe server is stopped for a moment and the current exe is kept "
                         "as erp-server.prev, so you can switch back again.").arg(previous);
    QPushButton *exeOnly = box.addButton(tr("Previous exe only"), QMessageBox::AcceptRole);
    QPushButton *withDb = nullptr;
    if (!backup.isEmpty() && applied > 0) {
        details += tr("\n\nThe last update applied %1 migration(s). “Exe and database” also restores the "
                      "database backup taken just before it:\n%2\n\nThe current database is kept under a new "
                      "name, so nothing is deleted. But anything entered since the update will not be in the "
                      "restored database.").arg(applied).arg(backup);
        withDb = box.addButton(tr("Exe and database"), QMessageBox::DestructiveRole);
    }
    box.addButton(QMessageBox::Cancel);
    box.setInformativeText(details);
    box.exec();

    QStringList args{QStringLiteral("rollback")};
    if (box.clickedButton() == withDb && withDb)
        args << QStringLiteral("--with-db");
    else if (box.clickedButton() != exeOnly)
        return;
    runEngine(Job::Rollback, args);
}

void DeployWindow::cancelJob()
{
    if (!m_process || m_critical)
        return;
    m_cancelRequested = true;
    const qint64 pid = m_process->processId();
    if (pid > 0)
        ::kill(-static_cast<pid_t>(pid), SIGTERM);
    appendLog(tr("Cancelling…"));
}

void DeployWindow::openLogs()
{
    const QString dir = QDir(m_info.value(QStringLiteral("work_dir"))).filePath(QStringLiteral("logs"));
    QDir().mkpath(dir);
    QDesktopServices::openUrl(QUrl::fromLocalFile(dir));
}

void DeployWindow::closeEvent(QCloseEvent *event)
{
    if (m_process) {
        if (m_critical) {
            QMessageBox::warning(this, tr("Update running"),
                                 tr("The server is being updated right now. Wait until it has finished."));
            event->ignore();
            return;
        }
        if (QMessageBox::question(this, tr("Job running"), tr("A job is still running. Cancel it and close?"))
            != QMessageBox::Yes) {
            event->ignore();
            return;
        }
        cancelJob();
        m_process->waitForFinished(5000);
    }
    event->accept();
}

// --------------------------------------------------------------- display --

void DeployWindow::renderStatus(bool fromCheck)
{
    const QString health = m_info.value(QStringLiteral("health"));
    const QString control = m_info.value(QStringLiteral("control")) == QLatin1String("systemd")
        ? tr("runs as the erp-server service")
        : tr("started by hand / desktop icon");
    if (health == QLatin1String("up"))
        m_serverLabel->setText(dot(kGreen) + tr(" Running and answering — %1 (%2)")
                                   .arg(m_info.value(QStringLiteral("health_url")), control));
    else if (health == QLatin1String("not-answering"))
        m_serverLabel->setText(dot(kOrange) + tr(" Running but not answering — %1").arg(m_info.value(QStringLiteral("health_url"))));
    else if (health == QLatin1String("stopped"))
        m_serverLabel->setText(dot(kRed) + tr(" Stopped"));
    else
        m_serverLabel->setText(dot(kRed) + tr(" Unknown"));

    const QString commit = m_info.value(QStringLiteral("deployed_commit"));
    if (!commit.isEmpty())
        m_deployedLabel->setText(tr("<b>%1 @ %2</b> — %3 &nbsp;·&nbsp; installed %4")
                                     .arg(m_info.value(QStringLiteral("deployed_branch")), shortHash(commit),
                                          m_info.value(QStringLiteral("deployed_subject")).toHtmlEscaped(),
                                          m_info.value(QStringLiteral("deployed_at"))));
    else
        m_deployedLabel->setText(tr("Installed by hand (not yet updated with this tool)"));

    const QString dbName = m_info.value(QStringLiteral("db_name"));
    m_databaseLabel->setText(dbName.isEmpty()
                                 ? tr("—")
                                 : tr("%1 · %2 migrations applied").arg(dbName, m_info.value(QStringLiteral("db_migrations"))));

    const QString remote = m_info.value(QStringLiteral("remote_commit"));
    if (!remote.isEmpty()) {
        QString text = tr("<b>%1</b> on GitHub: %2 — %3 (%4)")
                           .arg(m_info.value(QStringLiteral("branch")).toHtmlEscaped(), shortHash(remote),
                                m_info.value(QStringLiteral("remote_subject")).toHtmlEscaped(),
                                m_info.value(QStringLiteral("remote_date")));
        if (m_info.value(QStringLiteral("up_to_date")) == QLatin1String("yes"))
            text += tr(" &nbsp;·&nbsp; <span style=\"color:%1\">the server runs this version</span>").arg(kGreen.name());
        if (fromCheck)
            text += tr(" &nbsp;·&nbsp; checked %1").arg(m_info.value(QStringLiteral("fetched_at")));
        else
            text += tr(" &nbsp;·&nbsp; <i>from the last check — click “Check for updates” to refresh</i>");
        m_remoteLabel->setText(text);
    }

    if (fromCheck) {
        m_checked = m_result == QLatin1String("ok");
        m_checkedBranch = m_info.value(QStringLiteral("branch"));
    }
    if (!m_blocked.isEmpty()) {
        QStringList lines;
        for (const QString &reason : std::as_const(m_blocked))
            lines << QStringLiteral("• ") + reason.toHtmlEscaped();
        m_blockedLabel->setText(tr("<b>Cannot update from this branch:</b><br>") + lines.join(QStringLiteral("<br>")));
        m_blockedLabel->show();
    } else {
        m_blockedLabel->hide();
    }
    renderChanges();
    updateButtons();
}

void DeployWindow::renderChanges()
{
    m_changes->clear();
    if (m_info.value(QStringLiteral("remote_commit")).isEmpty())
        return;

    if (!m_extra.isEmpty()) {
        auto *extra = new QTreeWidgetItem(m_changes);
        extra->setText(0, tr("Only in the database, missing from the branch (%1) — blocks the update").arg(m_extra.size()));
        extra->setFirstColumnSpanned(true);
        extra->setForeground(0, kRed);
        for (const QString &name : std::as_const(m_extra)) {
            auto *item = new QTreeWidgetItem(extra);
            item->setText(0, name);
            item->setIcon(0, dotIcon(kRed));
        }
    }

    auto *pending = new QTreeWidgetItem(m_changes);
    pending->setText(0, tr("New database migrations to apply (%1)").arg(m_pending.size()));
    pending->setFirstColumnSpanned(true);
    for (const QString &name : std::as_const(m_pending)) {
        auto *item = new QTreeWidgetItem(pending);
        item->setText(0, name);
        item->setIcon(0, dotIcon(kGreen));
    }

    const bool sinceDeployed = m_info.value(QStringLiteral("commits_since")) == QLatin1String("deployed");
    auto *commits = new QTreeWidgetItem(m_changes);
    commits->setText(0, sinceDeployed
                            ? tr("New commits since the running version (%1)").arg(m_commits.size())
                            : tr("Latest commits on the branch (the running version is not known)"));
    commits->setFirstColumnSpanned(true);
    for (const QString &line : std::as_const(m_commits)) {
        const QStringList parts = line.split(QLatin1Char('|'));
        auto *item = new QTreeWidgetItem(commits);
        item->setText(0, QStringLiteral("%1  %2").arg(parts.value(0), parts.mid(3).join(QLatin1Char('|'))));
        item->setText(1, parts.value(1));
        item->setText(2, parts.value(2));
        item->setIcon(0, dotIcon(kBlue));
    }
    m_changes->expandAll();
}

void DeployWindow::showJobResult(Job job, int exitCode)
{
    const QString log = m_jobInfo.value(QStringLiteral("logfile"));
    const QString where = log.isEmpty() ? QString() : tr("\n\nLog: %1").arg(log);
    const QString failure = m_lastFailedStep > 0 && m_lastFailedStep <= m_stepTitles.size()
        ? tr("Step %1 (%2): %3").arg(m_lastFailedStep).arg(m_stepTitles.value(m_lastFailedStep - 1), m_lastFailure)
        : m_lastFailure;

    if (m_result == QLatin1String("ok")) {
        const QString text = job == Job::Rollback ? tr("The server runs the previous version again.")
            : m_buildOnlyRun ? tr("The build worked. The server was not touched.")
                             : tr("The server is updated and answering.");
        statusBar()->showMessage(text, 15000);
        QMessageBox::information(this, tr("Done"), text + where);
    } else if (m_result == QLatin1String("rolled-back")) {
        QMessageBox::warning(this, tr("Update failed — previous version restored"),
                             tr("The update failed:\n%1\n\nThe previous exe and database were put back and the "
                                "server is running again.").arg(failure) + where);
    } else if (m_result == QLatin1String("rollback-failed")) {
        QMessageBox::critical(this, tr("Update failed — server may be down"),
                              tr("The update failed:\n%1\n\nPutting the previous version back ALSO failed. The "
                                 "server may be down. Check the log before doing anything else.").arg(failure) + where);
    } else if (m_result == QLatin1String("cancelled") || m_cancelRequested) {
        statusBar()->showMessage(tr("Cancelled. The server was not changed."), 15000);
    } else if (m_result == QLatin1String("failed")) {
        QMessageBox::warning(this, job == Job::Rollback ? tr("Rollback failed") : tr("Update stopped"),
                             tr("%1\n\n%2").arg(failure.isEmpty() ? tr("The job failed.") : failure,
                                                job == Job::Rollback ? tr("See the log for the server state.")
                                                                     : tr("The server was not changed.")) + where);
    } else {
        QMessageBox::critical(this, tr("Deploy tool stopped"),
                              tr("The deploy script stopped unexpectedly (exit code %1). Check the log and the "
                                 "server status.").arg(exitCode) + where);
    }
}

void DeployWindow::resetSteps(const QStringList &titles)
{
    m_stepTitles = titles;
    m_steps->clear();
    for (int i = 0; i < titles.size(); ++i) {
        auto *item = new QListWidgetItem(dotIcon(kGrey), QStringLiteral("%1. %2").arg(i + 1).arg(titles.at(i)), m_steps);
        item->setForeground(palette().color(QPalette::PlaceholderText));
    }
}

void DeployWindow::setStepState(int number, StepState state, const QString &detail)
{
    QListWidgetItem *item = m_steps->item(number - 1);
    if (!item)
        return;
    QString text = QStringLiteral("%1. %2").arg(number).arg(m_stepTitles.value(number - 1));
    if (!detail.isEmpty())
        text += QStringLiteral("\n     ") + detail;
    item->setText(text);
    item->setForeground(palette().color(QPalette::Text));
    QFont font = m_steps->font();
    switch (state) {
    case StepState::Pending: item->setIcon(dotIcon(kGrey)); break;
    case StepState::Running:
        item->setIcon(dotIcon(kBlue));
        font.setBold(true);
        m_steps->scrollToItem(item);
        break;
    case StepState::Done: item->setIcon(dotIcon(kGreen)); break;
    case StepState::Skipped: item->setIcon(dotIcon(kGrey)); break;
    case StepState::Failed:
        item->setIcon(dotIcon(kRed));
        item->setForeground(kRed);
        break;
    }
    item->setFont(font);
}

void DeployWindow::updateButtons()
{
    const bool busy = m_process != nullptr;
    const bool engineOk = QFileInfo(m_engine).isFile();
    m_branchBox->setEnabled(!busy && engineOk);
    m_checkButton->setEnabled(!busy && engineOk && !branch().isEmpty());
    const bool canDeploy = m_checked && m_checkedBranch == branch() && m_blocked.isEmpty();
    m_deployButton->setEnabled(!busy && engineOk && canDeploy);
    m_deployButton->setToolTip(canDeploy ? QString() : tr("Click “Check for updates” first (and fix anything shown in red)."));
    m_buildOnlyBox->setEnabled(!busy);
    m_rollbackButton->setEnabled(!busy && engineOk && m_info.value(QStringLiteral("prev_exe")) == QLatin1String("yes"));
    m_cancelButton->setEnabled(busy && !m_critical && m_job != Job::Status && m_job != Job::Rollback);
    m_logsButton->setEnabled(!m_info.value(QStringLiteral("work_dir")).isEmpty());
}

void DeployWindow::appendLog(const QString &line) { m_log->appendPlainText(line); }
