// Standalone build — intentionally OUTSIDE the koshei root settings.gradle.kts. An external block
// engineer clones just this dir, builds against `io.koshei:sdk:0.2.0` from mavenLocal, and ships a jar.
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.9.0"
}
rootProject.name = "greet-plugin"
