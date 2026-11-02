// PEOS remains the authority; a school-admin role must not hide founder access.
export async function workspaceDestination(
  authority: () => Promise<{ founder: boolean }>,
  schools: () => Promise<Array<{principal?:boolean}>>,
  finance: () => Promise<Array<unknown>> = async () => [],
): Promise<"/founder" | "/principal" | "/admin" | "/finance" | null> {
  if ((await authority()).founder) return "/founder";
  const available=await schools();
  if(available.some(s=>s.principal===true))return "/principal";
  if (available.length) return "/admin";
  if ((await finance()).length) return "/finance";
  return null;
}
