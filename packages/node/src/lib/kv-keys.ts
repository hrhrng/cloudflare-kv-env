import type { ProjectLink } from "../types.js";

function base(link: ProjectLink): string {
  return `${link.keyPrefix}:${link.project}:${link.environment}`;
}

export function currentPointerKey(link: ProjectLink): string {
  return `${base(link)}:current`;
}

export function versionsPrefix(link: ProjectLink): string {
  return `${base(link)}:versions:`;
}

export function versionKey(link: ProjectLink, versionId: string): string {
  return `${versionsPrefix(link)}${versionId}`;
}

export function flatEnvVarsPrefix(link: ProjectLink): string {
  return `${base(link)}:vars:`;
}

export function flatEnvVarKey(link: ProjectLink, envVarName: string): string {
  return `${flatEnvVarsPrefix(link)}${envVarName}`;
}

export function flatEnvMetaKey(link: ProjectLink): string {
  return `${base(link)}:meta`;
}
