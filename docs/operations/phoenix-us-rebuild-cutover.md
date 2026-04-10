# Phoenix US Rebuild Cutover

- Target commit: aa44e615c4848df6f15cf393d965ad567f28048e
- Target corpus version: v6
- Reason: recreate eval configuration only; historical run data intentionally discarded
- Target Phoenix region: us-east4

## Baseline before rebuild

- Phoenix project count: 5 (`evaluators`, `polymorph`, `polymorph-preview`, `polymorph-prod`, `default`)
- Phoenix dataset count: 4 (`polymorph-capability-v6`, `polymorph-capability-v5`, `polymorph-capability-v4`, `polymorph-capability-v2`)
- Phoenix evaluator count: unavailable from the public REST surface on Phoenix `13.23.0`
- Phoenix deployment id: `9f156618-7fee-4fe7-92d8-4b24e03476c0`
