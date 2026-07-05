plugins { kotlin("jvm") }
kotlin { jvmToolchain(21) }
tasks.test { useJUnitPlatform() }
dependencies {
    implementation(project(":core"))
    implementation(project(":registry"))
    implementation(libs.jackson.kotlin)   // ConductorBackend (later) + canonical IR serialization
    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
}
