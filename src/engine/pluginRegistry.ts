import type { OdontogramPlugin } from "@/plugin";

let registeredPlugins: OdontogramPlugin[] = [];

/**
 * Access the list of currently registered engine plugins.
 */
export function getRegisteredPlugins(): OdontogramPlugin[] {
  return registeredPlugins;
}

/**
 * Set the list of currently registered engine plugins.
 */
export function setRegisteredPlugins(plugins: OdontogramPlugin[]): void {
  registeredPlugins = [...plugins];
}
