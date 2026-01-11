
import { SaavnSong } from '../types';
// @ts-ignore
import ID3Writer from 'browser-id3-writer';

const SEARCH_BASE_URL = "https://jiosaavn-api-privatecvc2.vercel.app/search/songs";

export const searchSongs = async (query: string, page: number = 1, limit: number = 20): Promise<SaavnSong[]> => {
  const url = `${SEARCH_BASE_URL}?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch songs");
  const result = await response.json();
  return result.data?.results || [];
};

export const formatDuration = (seconds: number) => {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(14, 5);
};

export const downloadSong = async (song: SaavnSong, downloadUrl: string): Promise<{ blobUrl: string, filename: string }> => {
  try {
    // 1. Fetch Audio
    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) throw new Error("Failed to fetch audio file");
    const audioBuffer = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get('content-type');

    // 2. Prepare Filename
    const cleanName = song.name.replace(/[^a-z0-9]/gi, '_');
    const cleanArtist = song.primaryArtists.split(',')[0].trim().replace(/[^a-z0-9]/gi, '_');
    let filename = `${cleanName} - ${cleanArtist}.mp3`;

    // 3. If it's MP3, we try to inject metadata. If it's MP4/AAC, we just download as is (renamed).
    // Note: ID3Writer strictly works on MP3 frames.
    const isMp3 = contentType?.includes('mpeg') || contentType?.includes('mp3') || downloadUrl.endsWith('.mp3');

    let finalBlob: Blob;

    if (isMp3) {
      // Fetch Cover Art
      let coverBuffer: ArrayBuffer | undefined;
      const coverUrl = song.image[song.image.length - 1]?.link;
      if (coverUrl) {
        try {
          const coverRes = await fetch(coverUrl);
          if (coverRes.ok) coverBuffer = await coverRes.arrayBuffer();
        } catch (e) {
          console.warn("Could not fetch cover art", e);
        }
      }

      const writer = new ID3Writer(audioBuffer);
      writer.setFrame('TIT2', song.name)
            .setFrame('TPE1', [song.primaryArtists])
            .setFrame('TALB', song.album.name)
            .setFrame('TYER', parseInt(song.year || new Date().getFullYear().toString()))
            .setFrame('TLEN', song.duration * 1000); // Duration in ms

      if (coverBuffer) {
        writer.setFrame('APIC', {
          type: 3, // cover front
          data: coverBuffer,
          description: 'Cover'
        });
      }

      writer.addTag();
      finalBlob = writer.getBlob();
    } else {
      // Fallback for non-mp3 files (e.g. m4a/aac) - we can't inject ID3 but we can fix filename
      finalBlob = new Blob([audioBuffer], { type: contentType || 'audio/mp4' });
      if (contentType?.includes('mp4') || contentType?.includes('aac')) {
          filename = filename.replace('.mp3', '.m4a');
      }
    }

    const blobUrl = URL.createObjectURL(finalBlob);
    return { blobUrl, filename };

  } catch (error) {
    console.error("Download processing failed:", error);
    throw error;
  }
};
