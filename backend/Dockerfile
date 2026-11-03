FROM maven:3.9.14-eclipse-temurin-21 AS build
WORKDIR /workspace/backend
COPY backend/pom.xml backend/mvnw backend/mvnw.cmd ./
COPY backend/.mvn .mvn
RUN chmod +x mvnw
COPY backend/src src
COPY database /workspace/database
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp verify

FROM build AS test
CMD ["./mvnw", "-B", "-ntp", "-Pmysql-it", "verify"]

FROM eclipse-temurin:21.0.10_7-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core curl && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app && mkdir /data && chown app:app /data
WORKDIR /app
COPY --from=build /workspace/backend/target/frameforge-1.0.0.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-Djava.awt.headless=true", "-Duser.timezone=UTC", "-jar", "app.jar"]
