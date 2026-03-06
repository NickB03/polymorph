// Model type definition for speed/quality selection
export type ModelType = 'speed' | 'quality'

const VALID_MODEL_TYPES: ModelType[] = ['speed', 'quality']

export function isValidModelType(value: unknown): value is ModelType {
  return (
    typeof value === 'string' && VALID_MODEL_TYPES.includes(value as ModelType)
  )
}
