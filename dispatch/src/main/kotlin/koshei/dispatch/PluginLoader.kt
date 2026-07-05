package koshei.dispatch

import koshei.sdk.Block
import java.io.File
import java.net.URLClassLoader

/**
 * Loads a plugin [Block] from a jar in an isolated child classloader. Parent = the loader that has
 * `:sdk` (this class's loader), so `koshei.sdk.Block` is the SAME Class in host and plugin (parent-first
 * delegation gives type identity — the `as Block` cast and `isAssignableFrom` work across the boundary).
 */
class PluginLoader(private val parent: ClassLoader = PluginLoader::class.java.classLoader) {
    fun load(jarPath: String, fqcn: String): Block {
        // The loader is intentionally NOT closed: on success it must outlive the returned Block (which
        // lazily resolves further plugin classes through it), and HandlerRegistry caches that Block for
        // the process lifetime. On the failure path the loader is unreferenced and GC-eligible (a minor
        // per-failed-attempt allocation — see HandlerRegistry I1). v0.2 keeps loaders process-lived.
        val loader = URLClassLoader(arrayOf(File(jarPath).toURI().toURL()), parent)  // parent-first
        val cls = Class.forName(fqcn, true, loader)
        // Chunk-5 gate greps this line to prove isolation (classloader of the loaded plugin class).
        println("[PluginLoader] loaded $fqcn via ${cls.classLoader}")
        require(Block::class.java.isAssignableFrom(cls)) { "$fqcn is not a koshei.sdk.Block" }
        return cls.getDeclaredConstructor().newInstance() as Block   // no-arg ctor required
    }
}
