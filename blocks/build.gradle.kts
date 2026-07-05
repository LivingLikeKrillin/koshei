plugins { kotlin("jvm") }
kotlin { jvmToolchain(21) }
tasks.test { useJUnitPlatform() }
dependencies {
    implementation(project(":sdk"))
    implementation(libs.postgresql)
    implementation(libs.jackson.kotlin)
    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.testcontainers.junit)
    // test-only: validate shipped manifests (Task 3.3 final). Deliberate test-scope exception to the
    // §4 boundary (blocks→core only in MAIN); no main-source cycle since blocks' main never imports registry.
    testImplementation(project(":registry"))
}
