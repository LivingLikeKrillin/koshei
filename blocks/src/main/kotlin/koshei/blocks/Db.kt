package koshei.blocks

import java.sql.Connection
import java.sql.DriverManager

/** Test code can mutate these to point at a Testcontainers instance. */
object DbConnectionOverride {
    var url: String? = null
    var user: String? = null
    var pass: String? = null
}

object Db {
    val url: String get() = DbConnectionOverride.url ?: System.getenv("KOSHEI_DB_URL") ?: "jdbc:postgresql://localhost:15432/koshei"
    val user: String get() = DbConnectionOverride.user ?: System.getenv("KOSHEI_DB_USER") ?: "koshei"
    val pass: String get() = DbConnectionOverride.pass ?: System.getenv("KOSHEI_DB_PASS") ?: "koshei"

    fun connect(): Connection = DriverManager.getConnection(url, user, pass)
}
