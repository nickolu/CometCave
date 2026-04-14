export function getMountDisplayName(mount: { customName?: string; name: string }): string {
  return mount.customName ?? mount.name
}
