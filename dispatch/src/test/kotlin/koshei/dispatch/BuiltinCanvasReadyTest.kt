package koshei.dispatch
import koshei.registry.CanvasReadiness
import kotlin.test.Test
import kotlin.test.assertTrue

class BuiltinCanvasReadyTest {
    @Test fun `all builtin contracts are canvas-ready`() {
        DispatchAssembly.builtinContracts.forEach { (key, c) ->
            assertTrue(CanvasReadiness.isReady(c), "$key not canvas-ready: ${CanvasReadiness.check(c)}")
        }
    }
}
