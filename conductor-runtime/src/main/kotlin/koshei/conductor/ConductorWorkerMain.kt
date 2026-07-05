package koshei.conductor

import com.netflix.conductor.client.automator.TaskRunnerConfigurer
import com.netflix.conductor.client.http.ConductorClient
import com.netflix.conductor.client.http.TaskClient
import com.netflix.conductor.client.worker.Worker
import koshei.blocks.Db
import koshei.dispatch.DispatchAssembly
import koshei.registry.BlockIndex
import koshei.registry.BlockStore

/** Default Conductor server URL (the `:18088` host port the compose service publishes). */
const val DEFAULT_CONDUCTOR_URL = "http://localhost:18088/api"

/**
 * Boots the in-process Conductor task workers (gate entrypoint).
 *
 * One [ForwardWorker] per builtin blockId (task type = blockId) plus one [CompensateWorker], all sharing one
 * registry (built via the neutral [DispatchAssembly] — no Temporal SDK) and one Postgres-backed [CompLedger].
 */
fun main() {
    val workerName = System.getenv("KOSHEI_WORKER_NAME") ?: "conductor-worker-1"
    val serverUrl = System.getenv("CONDUCTOR_SERVER_URL") ?: DEFAULT_CONDUCTOR_URL

    val registry = DispatchAssembly.buildRegistry(BlockIndex { Db.connect() }, BlockStore())
    val ledger = CompLedger { Db.connect() }

    // `merge` is the multi-input fan-in worker (ForwardWorker reads its left/right namedInputs); required so the
    // diamond DAG's join task is polled on the Conductor side (mirrors DagDiamondIT's worker set).
    val builtinIds = listOf("db.read", "transform.map", "db.upsert", "notify.email", "actuate", "merge")
    val workers: List<Worker> = builtinIds.map { ForwardWorker(it, registry, ledger) } +
        CompensateWorker(registry, ledger)

    val client = ConductorClient.builder().basePath(serverUrl).build()
    val taskClient = TaskClient(client)

    println("[$workerName] starting conductor workers against $serverUrl; task types=$builtinIds + compensate")
    TaskRunnerConfigurer.Builder(taskClient, workers)
        .withThreadCount(builtinIds.size + 1)
        .build()
        .init()
    println("[$workerName] conductor workers polling")
}
