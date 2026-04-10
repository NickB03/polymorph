# Phoenix US Rebuild Cutover

- Target commit: aa44e615c4848df6f15cf393d965ad567f28048e
- Target corpus version: v6
- Reason: recreate eval configuration only; historical run data intentionally discarded
- Target Phoenix region: us-east4
- Reset action: switched `PHOENIX_WORKING_DIR` from `/data/v3` to `/data/v4` on the mounted US Railway volume
- Reset deployment id: `ee763c56-39fe-4153-a402-e47637b4a96d`

## Baseline before rebuild

- Phoenix project count: 5 (`evaluators`, `polymorph`, `polymorph-preview`, `polymorph-prod`, `default`)
- Phoenix dataset count: 4 (`polymorph-capability-v6`, `polymorph-capability-v5`, `polymorph-capability-v4`, `polymorph-capability-v2`)
- Phoenix evaluator count: unavailable from the public REST surface on Phoenix `13.23.0`
- Phoenix deployment id: `9f156618-7fee-4fe7-92d8-4b24e03476c0`

## Rebuild runs

- Capability rebuild: `2026-04-10T13:57:53Z`, [experiment](https://phoenix-production-c6b5.up.railway.app/datasets/RGF0YXNldDox/compare?experimentId=RXhwZXJpbWVudDox)
- Capability rebuild status: dataset and experiment created from `aa44e61`; evaluator scoring blocked by exhausted OpenRouter credits
- Regression rebuild: `2026-04-10T14:06:18Z`, [experiment](https://phoenix-production-c6b5.up.railway.app/datasets/RGF0YXNldDoy/compare?experimentId=RXhwZXJpbWVudDoy)
- Regression rebuild status: dataset and experiment created from `aa44e61`; run stopped after creation because the same OpenRouter credit exhaustion would prevent evaluator completion
- Final `EVAL_RUN_MODE`: all

## Final state

- Phoenix project count after reset: 3 (`evaluators`, `polymorph-prod`, `default`)
- Rebuilt datasets: `polymorph-capability-v6`, `polymorph-regression-v6`
- Rebuilt experiments:
  - [polymorph-capability-2026-04-10-14h](https://phoenix-production-c6b5.up.railway.app/datasets/RGF0YXNldDox/compare?experimentId=RXhwZXJpbWVudDox)
  - [polymorph-regression-2026-04-10-14h](https://phoenix-production-c6b5.up.railway.app/datasets/RGF0YXNldDoy/compare?experimentId=RXhwZXJpbWVudDoy)
- Trace ingestion status: healthy (`/v1/traces` returned repeated `200` responses during the rebuild window)
- Remaining blocker: judge evaluators could not finish because the configured `JUDGE_API_KEY` on OpenRouter is out of credits
