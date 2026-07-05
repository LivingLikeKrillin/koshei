plugins {
    kotlin("jvm")
    application
}
kotlin { jvmToolchain(21) }
tasks.test { useJUnitPlatform() }
dependencies {
    implementation(project(":sdk"))
    implementation(libs.jackson.kotlin)
    implementation(libs.postgresql)
    implementation(libs.slf4j.simple)   // cf. :opcua — only for the standalone SimMain process
    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
    testImplementation(project(":registry"))   // ManifestsValidateTest — test scope only; main stays 0-registry
}
// Single source of truth: the repo-root model/ is the Git-canonical authority; the classpath copy is
// generated at build time (no committed duplicate, no drift). into("model") + exclude md are REQUIRED.
tasks.processResources {
    from(rootProject.file("model")) { into("model"); exclude("**/*.md") }
}
// Standalone scoring simulator for the gate/demo: ./gradlew :delegation:runSim
application { mainClass.set("koshei.delegation.SimMainKt") }
val envKeys = listOf(
    "KOSHEI_DELEGATION_URL", "KOSHEI_DELEGATION_POLICY", "KOSHEI_DELEGATION_SIM_PORT",
    "KOSHEI_DB_URL", "KOSHEI_DB_USER", "KOSHEI_DB_PASS",
)
fun JavaExec.fwd() = envKeys.forEach { k -> System.getenv(k)?.let { environment(k, it) } }
tasks.register<JavaExec>("runSim") {
    group = "application"; mainClass.set("koshei.delegation.SimMainKt")
    classpath = sourceSets["main"].runtimeClasspath; fwd()
    workingDir = rootDir   // repo root so a relative KOSHEI_DELEGATION_POLICY override resolves
}
