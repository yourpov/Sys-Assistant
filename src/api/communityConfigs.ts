import { invoke } from '@tauri-apps/api/core';

import type { CommentsPage, CommunityConfig, ConfigPerspective, ConfigType } from '../types';

export const COMMENTS_PAGE_SIZE = 40;

export function fetchCommunityConfigs(): Promise<CommunityConfig[]> {
  return invoke('fetch_community_configs');
}

export function fetchConfigComments(
configId : string,
options ?: { limit?: number; offset?: number; parentId?: string | null },
)        : Promise<CommentsPage> {
  return invoke('fetch_config_comments', {
    configId,
    limit   : options?.limit ?? COMMENTS_PAGE_SIZE,
    offset  : options?.offset ?? 0,
    parentId: options?.parentId ?? null,
  });
}

export function fetchConfigReaction(configId: string): Promise<1 | -1 | null> {
  return invoke('fetch_config_reaction', { configId });
}

export function setConfigReaction(configId: string, reaction: 1 | -1): Promise<void> {
  return invoke('set_config_reaction', { configId, reaction });
}

export function clearConfigReaction(configId: string): Promise<void> {
  return invoke('clear_config_reaction', { configId });
}

export function postConfigComment(configId: string, body: string, parentId?: string | null): Promise<void> {
  return invoke('post_config_comment', { configId, body, parentId: parentId ?? null });
}

export function updateConfigComment(commentId: string, body: string): Promise<void> {
  return invoke('update_config_comment', { commentId, body });
}

export function deleteConfigComment(commentId: string): Promise<void> {
  return invoke('delete_config_comment', { commentId });
}

export function createConfig(
name       : string,
note       : string,
type       : ConfigType,
perspective: ConfigPerspective | null,
data       : unknown,
)          : Promise<void> {
  return invoke('create_config', { name, note, type, perspective, data });
}

export function updateConfig(
configId   : string,
name       : string,
note       : string,
type       : ConfigType,
perspective: ConfigPerspective | null,
data       : unknown,
)          : Promise<void> {
  return invoke('update_config', { configId, name, note, type, perspective, data });
}

export function deleteConfig(configId: string): Promise<void> {
  return invoke('delete_config', { configId });
}