package koshei.authoring.assist

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Selects the LlmAssistPort by env (mirrors EngineConfig/ApplyPortFactory). Default = the deterministic
 * fake (safe keyless default). KOSHEI_LLM_ASSIST=anthropic wires the real port (Chunk 2).
 */
@Configuration
class LlmAssistConfig {
    @Bean
    fun llmAssistPort(): LlmAssistPort = when (System.getenv("KOSHEI_LLM_ASSIST")) {
        "anthropic" -> AnthropicLlmAssistPort()
        else -> FakeLlmAssistPort(listOf(FakeLlmAssistPort.DEMO))
    }

    @Bean
    fun fsmAssistService(port: LlmAssistPort): FsmAssistService = FsmAssistService(port)
}
