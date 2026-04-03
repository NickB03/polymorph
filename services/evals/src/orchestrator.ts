import { runCapabilitySuite } from './runners/capability'
import { runRegressionSuite } from './runners/regression'
import { runSmokeSuite } from './runners/smoke'
import { runTrafficMonitorSuite } from './runners/traffic-monitor'
import { config } from './config'

export async function runConfiguredModes() {
  switch (config.evalRunMode) {
    case 'capability':
      await runCapabilitySuite()
      return
    case 'regression':
      await runRegressionSuite()
      return
    case 'traffic-monitor':
      await runTrafficMonitorSuite()
      return
    case 'smoke':
      await runSmokeSuite()
      return
    case 'all':
      await runCapabilitySuite()
      await runRegressionSuite()
      await runTrafficMonitorSuite()
      await runSmokeSuite()
      return
  }
}
