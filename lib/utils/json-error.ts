export function jsonError(
  code: string,
  message: string,
  status: number
): Response {
  return new Response(JSON.stringify({ code, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
