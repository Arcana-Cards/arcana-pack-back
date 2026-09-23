pipeline {
    agent {
        kubernetes {
            inheritFrom 'kaniko'
        }
    }

    environment {
        IMAGE_NAME = "anacra-pack-back"
        REGISTRY_URL = "docker.io"
        REGISTRY_NAMESPACE = "villaroyakevin"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup') {
            steps {
                script {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH?.replaceFirst(/^origin\//, '') ?: "unknown"
                    def tag = (branch in ['main', 'master']) ? "latest" : "dev"

                    env.IMAGE_TAG = tag
                    env.IMAGE_FULL = "${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${tag}"

                    echo "Branch: ${branch} | Image: ${env.IMAGE_FULL}"
                }
            }
        }

        stage('Build & Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'dev'
                }
            }
            steps {
                container('kaniko') {
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {

                        sh '''
                        set -e

                        mkdir -p /kaniko/.docker

                        AUTH=$(printf "%s:%s" "$DOCKER_USER" "$DOCKER_PASS" | base64 -w0)

                        cat > /kaniko/.docker/config.json <<EOF
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "$AUTH"
    }
  }
}
EOF

                        chmod 600 /kaniko/.docker/config.json

                        /kaniko/executor \
                          --context $(pwd) \
                          --dockerfile Dockerfile \
                          --destination ${IMAGE_FULL} \
                          --cache=true \
                          --no-push-cache \
                          --verbosity=info
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "✓ Pipeline SUCCESS"
        }
        failure {
            echo "✗ Pipeline FAILED"
        }
    }
}
