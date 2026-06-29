export async function readRequestBody<T>(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Partial<T>;
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries()) as Partial<T>;
}
