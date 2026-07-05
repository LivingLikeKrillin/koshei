package koshei.opcua

import java.sql.Connection
import java.sql.DriverManager

/**
 * Test code can mutate these to point at a Testcontainers instance.
 * Mirrors [koshei.blocks.DbConnectionOverride] so `:opcua` does NOT depend on `:blocks`.
 */
object OpcuaDbConnectionOverride {
    var url: String? = null
    var user: String? = null
    var pass: String? = null
}

/**
 * Minimal JDBC connection factory for the OPC-UA module's command audit.
 * Reads the same env keys as `:blocks`/`Db.kt` so both modules write to the same Postgres.
 * Kept here (not re-used from `:blocks`) so `:opcua` stays free of `:blocks` as a dependency.
 */
object OpcuaDb {
    val url: String get() = OpcuaDbConnectionOverride.url ?: System.getenv("KOSHEI_DB_URL") ?: "jdbc:postgresql://localhost:15432/koshei"
    val user: String get() = OpcuaDbConnectionOverride.user ?: System.getenv("KOSHEI_DB_USER") ?: "koshei"
    val pass: String get() = OpcuaDbConnectionOverride.pass ?: System.getenv("KOSHEI_DB_PASS") ?: "koshei"

    fun connect(): Connection = DriverManager.getConnection(url, user, pass)
}
