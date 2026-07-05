package koshei.authoring

import koshei.registry.ManifestLoader
import koshei.registry.Registry
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.io.File

/**
 * POST /api/publish — multipart (`contract` JSON part + `jar` file part). The authoring UI owns the
 * contract; the jar supplies only the handler class. Delegates to [Registry.publish] (the single gating
 * path, spec §5.2): 200 {ok:true} on success, 400 {ok:false, errors} on a gating failure.
 */
@RestController
@RequestMapping("/api")
class PublishController(private val registry: Registry) {
    @PostMapping("/publish")
    fun publish(
        @RequestPart("contract") contract: MultipartFile,
        @RequestPart("jar") jar: MultipartFile,
    ): ResponseEntity<PublishResponse> {
        val parsed = ManifestLoader.fromJson(String(contract.bytes, Charsets.UTF_8))
        val tmp = File.createTempFile("publish-", ".jar")
        return try {
            jar.transferTo(tmp)
            val r = registry.publish(tmp, parsed)
            if (r.ok) ResponseEntity.ok(PublishResponse(true))
            else ResponseEntity.status(HttpStatus.BAD_REQUEST).body(PublishResponse(false, r.errors))
        } finally {
            tmp.delete()
        }
    }
}
