export function getMuxThumbnailUrl(playbackId: string | null | undefined, options?: { width?: number; height?: number; time?: number }): string | null {
  if (!playbackId || playbackId.length < 5) return null;
  
  const params = new URLSearchParams();
  if (options?.width) params.set('width', options.width.toString());
  if (options?.height) params.set('height', options.height.toString());
  if (options?.time !== undefined) params.set('time', options.time.toString());
  
  const queryString = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${queryString ? `?${queryString}` : ''}`;
}
