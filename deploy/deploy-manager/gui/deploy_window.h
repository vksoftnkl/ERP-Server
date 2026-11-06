#pragma once

#include <QMainWindow>
#include <QMap>
#include <QProcess>
#include <QStringList>

class QCheckBox;
class QComboBox;
class QLabel;
class QListWidget;
class QPlainTextEdit;
class QPushButton;
class QTreeWidget;

// Front end for erp-deploy.sh: shows what the server runs, what is new on
// GitHub, and runs an update or rollback when a button is clicked. All the
// work (git, build, backup, migrations, restart) happens in the script; this
// window only starts it and reads its "::" progress lines.
class DeployWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit DeployWindow(QWidget *parent = nullptr);

protected:
    void closeEvent(QCloseEvent *event) override;

private:
    enum class Job { None, Status, Check, Branches, Deploy, Rollback };
    enum class StepState { Pending, Running, Done, Skipped, Failed };

    void buildUi();
    void runEngine(Job job, const QStringList &args);
    void readOutput();
    void handleLine(const QString &line);
    void jobFinished(int exitCode, QProcess::ExitStatus exitStatus);

    void refreshStatus();
    void loadBranches();
    void checkForUpdates();
    void startDeploy();
    void startRollback();
    void cancelJob();
    void openLogs();

    void renderStatus(bool fromCheck);
    void renderChanges();
    void showJobResult(Job job, int exitCode);
    void resetSteps(const QStringList &titles);
    void setStepState(int number, StepState state, const QString &detail = {});
    void updateButtons();
    void appendLog(const QString &line);
    QString branch() const;

    QString m_engine;
    QProcess *m_process = nullptr;
    Job m_job = Job::None;
    QByteArray m_buffer;
    bool m_cancelRequested = false;
    bool m_critical = false;
    bool m_buildOnlyRun = false;
    bool m_firstStatus = true;
    QString m_result;
    QString m_lastFailure;
    int m_lastFailedStep = 0;

    // From the last status/check run.
    QMap<QString, QString> m_info;
    QMap<QString, QString> m_jobInfo;
    QStringList m_blocked;
    QStringList m_commits;
    QStringList m_pending;
    QStringList m_extra;
    QStringList m_branches;
    QStringList m_stepTitles;
    bool m_checked = false;
    QString m_checkedBranch;

    QLabel *m_serverLabel = nullptr;
    QLabel *m_deployedLabel = nullptr;
    QLabel *m_databaseLabel = nullptr;
    QLabel *m_remoteLabel = nullptr;
    QLabel *m_blockedLabel = nullptr;
    QComboBox *m_branchBox = nullptr;
    QPushButton *m_checkButton = nullptr;
    QPushButton *m_deployButton = nullptr;
    QPushButton *m_rollbackButton = nullptr;
    QPushButton *m_cancelButton = nullptr;
    QPushButton *m_logsButton = nullptr;
    QCheckBox *m_buildOnlyBox = nullptr;
    QTreeWidget *m_changes = nullptr;
    QListWidget *m_steps = nullptr;
    QPlainTextEdit *m_log = nullptr;
};
