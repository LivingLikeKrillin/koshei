package koshei.authoring

import com.netflix.conductor.client.http.ConductorClient
import io.temporal.client.WorkflowClient
import io.temporal.serviceclient.WorkflowServiceStubs
import koshei.registry.Registry
import koshei.registry.WorkflowStore
import koshei.runtime.DataConverterSupport
import koshei.runtime.EnginePort
import koshei.runtime.TemporalEnginePort
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

const val TASK_QUEUE = "koshei-v0_1-tq"     // mirror koshei.app.TASK_QUEUE (worker + control plane must agree)

/**
 * Routes a run to the EnginePort for its engine. Each port is built via Kotlin `lazy {}` so a Temporal-only
 * deployment never constructs the Conductor client (and vice-versa) — per-engine deferral with zero Spring
 * bean ambiguity (no two `EnginePort` beans, no `@Qualifier`). Unknown engine falls back to "temporal".
 */
class EngineRouter(private val ports: Map<String, Lazy<EnginePort>>) {
    fun port(engine: String): EnginePort = (ports[engine] ?: ports.getValue("temporal")).value
}

@Configuration
class EngineConfig {
    @Bean
    fun engineRouter(store: WorkflowStore, registry: Registry, compLedger: koshei.conductor.CompLedger): EngineRouter {
        val temporal = lazy {
            TemporalEnginePort(
                WorkflowClient.newInstance(WorkflowServiceStubs.newLocalServiceStubs(), DataConverterSupport.clientOptions()),
                TASK_QUEUE,
            ) as EnginePort
        }
        val conductor = lazy {
            val url = System.getenv("KOSHEI_CONDUCTOR_URL") ?: "http://localhost:8088/api"
            ConductorEnginePort(ConductorClient.builder().basePath(url).build(), store, registry, compLedger) as EnginePort
        }
        return EngineRouter(mapOf("temporal" to temporal, "conductor" to conductor))
    }
}
