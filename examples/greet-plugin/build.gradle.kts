plugins { kotlin("jvm") version "2.2.0" }
repositories { mavenCentral(); mavenLocal() }
kotlin { jvmToolchain(21) }
dependencies { compileOnly("io.koshei:sdk:0.2.0") }   // host provides sdk at runtime (isolation loader)
