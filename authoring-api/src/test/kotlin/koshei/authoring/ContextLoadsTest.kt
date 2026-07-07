package koshei.authoring

import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.MockBean
import kotlin.test.Test

@SpringBootTest
class ContextLoadsTest {
    // The canonicalSetpoints bean eagerly parses the ①-published canonical (KOSHEI_RECIPE_SETPOINTS) at boot;
    // that published input is absent in the unit-test env, so mock it — this test only verifies bean wiring.
    @MockBean lateinit var canonicalSetpoints: koshei.opcua.CanonicalSetpoints
    @Test fun contextLoads() {}
}
