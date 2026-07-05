plugins { kotlin("jvm") }
kotlin { jvmToolchain(21) }
tasks.test { useJUnitPlatform() }
dependencies {
    implementation(project(":core"))
    implementation(project(":registry"))
    implementation(project(":blocks"))
    implementation(project(":sdk"))
    implementation(project(":opcua")) {
        // slf4j-simple is only for opcua's standalone SimMain process; exclude it here so it doesn't
        // conflict with Logback on :dispatch/:authoring-api's classpath.
        exclude(group = "org.slf4j", module = "slf4j-simple")
    }
    implementation(project(":delegation")) {
        // slf4j-simple is only for delegation's standalone SimMain; exclude it here (Logback on :dispatch).
        exclude(group = "org.slf4j", module = "slf4j-simple")
    }
    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
}
