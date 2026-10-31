import type { SavedChannel } from './channelDigestStore';

/** Merge a resolved channel into the latest local list, not a stale pre-network snapshot. */
export function mergeResolvedChannel(
  current: SavedChannel[],
  resolved: SavedChannel,
  maxChannels: number,
): SavedChannel[] {
  if (current.some((channel) => channel.channelId === resolved.channelId)) return current;
  if (current.length >= maxChannels) throw new Error(`You can add up to ${maxChannels} channels.`);
  return [...current, resolved];
}
