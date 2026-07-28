# defines the default .war file build stage (options: builder, external_builder)
ARG WAR_FILE_STAGE="builder"

#-----------------------------------------------------------------------------------------------------------------------
# build stage
#-----------------------------------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM docker.io/eclipse-temurin:25-jdk-noble AS builder

# some Apple M1 (arm64) builds need python3 and build-essential(make+gcc) for node-gyp to not fail
RUN echo "Installing build dependencies" \
  && apt-get update && apt-get install -y --no-install-recommends python3 build-essential \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/doc-apply
# copy gradle related files
COPY gradlew gradlew.bat ./
COPY build.gradle gradle.properties settings.gradle ./
COPY gradle gradle/
# copy openapi generator subproject (required by settings.gradle)
COPY openapi-generator-angular21/build.gradle openapi-generator-angular21/build.gradle
# copy pnpm related files and install node modules
# (from https://stackoverflow.com/questions/63961934/how-to-use-docker-build-cache-when-version-bumping-a-react-app)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# also copy this script which is required by postinstall lifecycle hook
RUN \
  # Mount global cache for Gradle (project cache in /opt/doc-apply/.gradle doesn't seem to be populated)
  --mount=type=cache,target=/root/.gradle/caches \
  # Mount cache for pnpm
  --mount=type=cache,target=/opt/doc-apply/.pnpm-store \
  # Create .pnpm-store directory if not yet available
  mkdir -p /opt/doc-apply/.pnpm-store \
  # Point pnpm at the cache mount as its store
  && ./gradlew -i --stacktrace --no-daemon -Pprod -Pwar pnpmSetCacheDockerfile \
  # Pre-populate the pnpm and gradle caches if related files change (see COPY statements above)
  && ./gradlew -i --stacktrace --no-daemon -Pprod -Pwar pnpmInstall

# so far just using the .dockerignore to define what isn't necessary here
COPY . .

# Branch name passed in from CI. The repo is checked out in detached HEAD during the workflow,
# so the gradle-git-properties plugin would otherwise record git.branch=HEAD.
ARG GIT_BRANCH=""
ENV GIT_BRANCH=$GIT_BRANCH

RUN \
  # Mount global cache for Gradle (project cache in /opt/doc-apply/.gradle doesn't seem to be populated)
  --mount=type=cache,target=/root/.gradle/caches \
  # Mount cache for pnpm
  --mount=type=cache,target=/opt/doc-apply/.pnpm-store \
  # Mount cache for the Angular CLI
  --mount=type=cache,target=/opt/doc-apply/.cache \
  # Build the .war file
  ./gradlew -i --stacktrace --no-daemon -Pprod -Pwar clean bootWar

#-----------------------------------------------------------------------------------------------------------------------
# external build stage
#-----------------------------------------------------------------------------------------------------------------------
FROM docker.io/library/alpine:3.23.3 AS external_builder

#default path of the built .war files
ARG WAR_FILE_PATH="/opt/doc-apply/build/libs"

# transfer the .war file from the current directory to the default WAR_FILE_PATH
WORKDIR ${WAR_FILE_PATH}
COPY ./build/libs/*.war doc-apply.war

#-----------------------------------------------------------------------------------------------------------------------
# war file stage (decides whether an external .war file will be used or the Docker built .war file)
#-----------------------------------------------------------------------------------------------------------------------
FROM ${WAR_FILE_STAGE} AS war_file

#-----------------------------------------------------------------------------------------------------------------------
# runtime stage
#-----------------------------------------------------------------------------------------------------------------------
FROM docker.io/eclipse-temurin:25-jre-noble AS runtime

#default path of the built .war files
ARG WAR_FILE_PATH="/opt/doc-apply/build/libs"

# Docker Compose: wget (healthcheck docker compose)
# docapply: graphviz, locales
RUN echo "Installing needed dependencies" \
  && apt-get update && apt-get install -y --no-install-recommends locales graphviz wget \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# See https://github.com/ls1intum/Artemis/issues/4439
RUN \
  echo "Fixing locales" \
  && sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
  && locale-gen
ENV LC_ALL=en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US.UTF-8

# Copy doc-apply.war to execution location
WORKDIR /opt/doc-apply

COPY --from=war_file ${WAR_FILE_PATH}/*.war doc-apply.war

# Copy build files needed by the admin dependencies page to parse project dependencies at runtime
COPY --from=builder /opt/doc-apply/build.gradle build.gradle
COPY --from=builder /opt/doc-apply/gradle.properties gradle.properties
COPY --from=builder /opt/doc-apply/package.json package.json

EXPOSE 8080

# use exec format (square brackets) as otherwise the shell fromat will not forward signals
CMD [ "java", \
  "-Djdk.tls.ephemeralDHKeySize=2048", \
  "-DLC_CTYPE=UTF-8", \
  "-Dfile.encoding=UTF-8", \
  "-Dsun.jnu.encoding=UTF-8", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Xmx5120m", \
  "-Xms2560m", \
  "--add-modules", "java.se", \
  "--add-exports", "java.base/jdk.internal.ref=ALL-UNNAMED", \
  "--add-exports", "java.naming/com.sun.jndi.ldap=ALL-UNNAMED", \
  "--add-opens", "java.base/java.lang=ALL-UNNAMED", \
  "--add-opens", "java.base/java.nio=ALL-UNNAMED", \
  "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED", \
  "--add-opens", "java.management/sun.management=ALL-UNNAMED", \
  "--add-opens", "jdk.management/com.sun.management.internal=ALL-UNNAMED", \
  "-jar", "/opt/doc-apply/doc-apply.war" ]
