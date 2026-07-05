package koshei.runtime

import koshei.dispatch.PluginLoader
import koshei.sdk.Block
import koshei.sdk.BlockInput
import java.net.URLClassLoader
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Proves ISOLATION, not just "a class loads". The fixture Block is compiled at test time from Java
 * source (no Kotlin compiler needed in-test) against the real :sdk classes, jarred, and loaded via
 * PluginLoader. The class is NEVER on the test/parent classpath (it lives only in the temp jar), so
 * if PluginLoader leaked to the system loader the cast and resolution would fail.
 */
class PluginLoaderTest {

    @Test fun `loads a real Block from an isolated jar with type identity`() {
        val jar = FixtureBlockJar.build(withManifest = false)
        val loaded: Block = PluginLoader().load(jar.absolutePath, FixtureBlockJar.FQCN)

        // (a) type identity across the loader boundary: the cast to koshei.sdk.Block succeeded.
        assertEquals(FixtureBlockJar.ID, loaded.id)

        // (b) forward returns the expected output (real execution through the plugin class).
        val out = loaded.forward(BlockInput())
        assertEquals(listOf(mapOf("hello" to "world")), out.rows)

        // (c) isolation: the class came from a child URLClassLoader, NOT the system loader.
        val cl = loaded.javaClass.classLoader
        assertTrue(cl !== ClassLoader.getSystemClassLoader(), "plugin must not load from system loader")
        assertTrue(cl is URLClassLoader, "plugin must load from a URLClassLoader, got ${cl::class.java}")
    }

    @Test fun `rejects a class that is not a Block`() {
        // String is on the parent classpath but is not a koshei.sdk.Block.
        val ex = runCatching { PluginLoader().load("ignored.jar", "java.lang.String") }.exceptionOrNull()
        assertTrue(ex is IllegalArgumentException || ex is IllegalStateException, "expected require() failure, got $ex")
    }
}
