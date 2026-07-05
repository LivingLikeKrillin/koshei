plugins { kotlin("jvm") }
kotlin { jvmToolchain(21) }
tasks.test { useJUnitPlatform() }
dependencies {
    implementation(project(":core"))
    implementation(project(":registry"))
    implementation(project(":blocks"))
    implementation(project(":dispatch"))
    implementation(project(":compiler"))
    implementation(project(":sdk"))
    implementation(libs.temporal.sdk)
    implementation(libs.jackson.kotlin)
    implementation(libs.jackson.yaml)
    implementation(libs.slf4j.simple)
    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.temporal.testing)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.testcontainers.junit)
}
