pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    triggers {
        cron('H 0 * * *')
        pollSCM('H/5 * * * *')
    }

    environment {
        CHROME_PATH = sh(
            script: '''
                for candidate in \
                    /usr/bin/google-chrome-stable \
                    /usr/bin/google-chrome \
                    /usr/bin/chromium-browser \
                    /usr/bin/chromium \
                    /snap/bin/chromium; do
                    [ -x "$candidate" ] && echo "$candidate" && break
                done
            ''',
            returnStdout: true
        ).trim()
        NODE_ENV = 'production'
        NO_UPDATE_NOTIFIER = '1'
    }

    stages {
        stage('Validate Chrome') {
            steps {
                script {
                    if (!env.CHROME_PATH) {
                        error('No Chrome/Chromium binary found. Install google-chrome-stable or chromium-browser on the agent.')
                    }
                    echo "Chrome: ${env.CHROME_PATH}"
                    sh "${env.CHROME_PATH} --version"
                }
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci --prefer-offline'
            }
        }

        stage('Typecheck') {
            steps {
                sh 'npm run typecheck'
            }
        }

        stage('Audit') {
            steps {
                // exits 1 if any threshold fails — catchError keeps pipeline UNSTABLE
                // so Archive stage still runs and reports are saved
                catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                    sh 'npm run audit'
                }
            }
        }

        stage('Archive Reports') {
            steps {
                archiveArtifacts(
                    artifacts: 'lighthouse-reports/**/*.html, lighthouse-reports/**/*.json',
                    fingerprint: true,
                    allowEmptyArchive: false
                )
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'lighthouse-reports',
                    reportFiles: '*.report.html',
                    reportName: 'Lighthouse Report',
                    reportTitles: 'vkrana.me Lighthouse'
                ])
            }
        }
    }

    post {
        always {
            sh 'rm -rf lighthouse-reports || true'
        }
        success {
            echo 'All Lighthouse thresholds passed.'
        }
        unstable {
            echo 'One or more Lighthouse score thresholds failed. Check Audit stage logs.'
        }
        failure {
            echo 'Pipeline failed. Check Validate Chrome or Install stage logs.'
        }
    }
}
