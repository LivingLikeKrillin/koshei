package koshei.delegation

import java.sql.Connection
import java.sql.DriverManager

object DelegationDbConnectionOverride { var url: String? = null; var user: String? = null; var pass: String? = null }

/** Minimal JDBC factory for delegation audit; reads the same KOSHEI_DB_* env as :opcua/:blocks. */
object DelegationDb {
    val url: String get() = DelegationDbConnectionOverride.url ?: System.getenv("KOSHEI_DB_URL") ?: "jdbc:postgresql://localhost:15432/koshei"
    val user: String get() = DelegationDbConnectionOverride.user ?: System.getenv("KOSHEI_DB_USER") ?: "koshei"
    val pass: String get() = DelegationDbConnectionOverride.pass ?: System.getenv("KOSHEI_DB_PASS") ?: "koshei"
    fun connect(): Connection = DriverManager.getConnection(url, user, pass)
}
