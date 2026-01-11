
import { SaavnSong } from '../types';
// @ts-ignore
import ID3Writer from 'browser-id3-writer';
import { decryptUrl, getHighResImage } from './cryptoService';

const SEARCH_BASE_URL = "https://jiosaavn-api-privatecvc2.vercel.app/search/songs";

export const searchSongs = async (query: string, page: number = 1, limit: number = 20): Promise<SaavnSong[]> => {
  const url = `${SEARCH_BASE_URL}?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch songs");
  const result = await response.json();

  const songs = result.data?.results || [];

  return songs.map((song: any) => {
    const decryptedUrl = song.encrypted_media_url ? decryptUrl(song.encrypted_media_url) : '';

    // Generate download links if decryption was successful
    let downloadUrls: any[] = [];
    if (decryptedUrl) {
      downloadUrls = [
        { quality: '12kbps', link: decryptedUrl.replace('_320.mp4', '_12.mp4') },
        { quality: '48kbps', link: decryptedUrl.replace('_320.mp4', '_48.mp4') },
        { quality: '96kbps', link: decryptedUrl.replace('_320.mp4', '_96.mp4') },
        { quality: '160kbps', link: decryptedUrl.replace('_320.mp4', '_160.mp4') },
        { quality: '320kbps', link: decryptedUrl }
      ];
    } else if (song.downloadUrl) {
      // Fallback to existing if no encrypted url (rare)
      downloadUrls = song.downloadUrl;
    }

    // Map to our Interface
    // Note: The Search API returns a slightly different shape than the Details API, so we normalize here.
    return {
      id: song.id,
      name: song.title || song.song || song.name,
      album: {
        id: song.albumid || song.album_id,
        name: song.album || song.album_name,
        url: song.album_url || ''
      },
      year: song.year,
      releaseDate: song.release_date,
      duration: parseInt(song.duration),
      label: song.label,
      primaryArtists: song.primary_artists || song.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ') || '',
      featuredArtists: song.featured_artists || '',
      image: song.image ? (Array.isArray(song.image) ? song.image : [
        { quality: '150x150', link: song.image.replace('150x150', '150x150') },
        { quality: '500x500', link: getHighResImage(song.image) },
        { quality: '500x500', link: getHighResImage(song.image) }
      ]) : [],
      downloadUrl: downloadUrls,
      encrypted_media_url: song.encrypted_media_url
    } as SaavnSong;
  });
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
        .setFrame('TPE2', song.primaryArtists) // Album Artist
        .setFrame('TALB', song.album.name)
        .setFrame('TYER', parseInt(song.year || new Date().getFullYear().toString()))
        .setFrame('TLEN', song.duration * 1000)
        .setFrame('TPUB', song.label) // Publisher
        .setFrame('TCOP', `© ${song.year} ${song.label}`); // Copyright

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
