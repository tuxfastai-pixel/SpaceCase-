// PEOS remains the authority; a school-admin role must not hide founder access.
export async function workspaceDestination(
  authority: () => Promise<{ founder: boolean }>,
  schools: () => Promise<unknown[]>,
): Promise<"/founder" | "/admin" | null> {
  if ((await authority()).founder) return "/founder";
  if ((await schools()).length) return "/admin";
  return null;
}
