package koshei.opcua

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue

/** Minimal Jackson helper for the OPC-UA module (mirrors koshei.blocks.Json — kept local so :opcua stays free of :blocks). */
internal object OpcuaJson {
    private val mapper = jacksonObjectMapper()
    fun write(value: Any?): String = mapper.writeValueAsString(value)
    inline fun <reified T> read(s: String): T = mapper.readValue(s)
}
