package koshei.runtime

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.temporal.client.WorkflowClientOptions
import io.temporal.common.converter.DefaultDataConverter
import io.temporal.common.converter.JacksonJsonPayloadConverter

/**
 * Kotlin-aware Temporal client options. (REF: spike TemporalClientSupport.clientOptions().)
 *
 * SDK 1.25.1's default JacksonJsonPayloadConverter uses a plain ObjectMapper that cannot construct
 * Kotlin data classes lacking a no-arg constructor (e.g. WorkflowInput/WorkflowOutput). Both the
 * Worker and the Starter build their WorkflowClient with these options so the same Kotlin-module-aware
 * JSON converter is used worker-side and client-side. SDK config only; the saga logic is untouched.
 * (Mandatory — see design §8.)
 */
object DataConverterSupport {
    fun clientOptions(): WorkflowClientOptions {
        val mapper = jacksonObjectMapper()
        val dataConverter = DefaultDataConverter.newDefaultInstance()
            .withPayloadConverterOverrides(JacksonJsonPayloadConverter(mapper))
        return WorkflowClientOptions.newBuilder().setDataConverter(dataConverter).build()
    }
}
