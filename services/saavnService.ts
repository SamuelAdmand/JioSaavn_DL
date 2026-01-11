
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
      // API often returns album as an object {id, name, url}. We MUST strictly flatten it to a string here.
      album: (typeof song.album === 'object' && song.album !== null) ? song.album.name : (song.album || song.album_name || ''),
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

// @ts-ignore
import MP4Box from 'mp4box';

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
    // Default to m4a (aac) which is what JioSaavn mostly sends for high quality
    let filename = `${cleanName} - ${cleanArtist}.m4a`;

    // 3. Fetch Cover Art
    let coverBuffer: ArrayBuffer | undefined;
    const coverUrl = song.image[song.image.length - 1]?.link || song.image[0]?.link;
    if (coverUrl) {
      try {
        const coverRes = await fetch(coverUrl);
        if (coverRes.ok) coverBuffer = await coverRes.arrayBuffer();
      } catch (e) { console.warn("Cover art fetch failed", e); }
    }

    let finalBlob: Blob = new Blob([audioBuffer], { type: 'audio/mp4' });

    // 4. Try MP4 Metadata Embedding using MP4Box
    try {
      // Only attempt if it looks like an MP4/M4A stream
      if (contentType?.includes('mp4') || contentType?.includes('aac') || downloadUrl.endsWith('.m4a') || downloadUrl.endsWith('.mp4')) {
        const mp4boxfile = MP4Box.createFile();

        // We need to repackage the atoms to insert metadata. 
        // NOTE: MP4Box.js in browser is complex for *writing* back to a blob from a flat buffer 
        // without a full re-mux flow which is heavy. 

        // ALTERNATIVE: Since browser-side atomic writing is rare/heavy, we often stick to ID3 for MP3.
        // If the user insists on "Android repo" parity, they are using native libraries.
        // For now, we will stick to the previous "Force MP3" if it works for them (many players handle ID3-on-AAC).
        // BUT, if they said "still no album art", it implies their player blocked the ID3-on-AAC hack.

        // Strategy: We will try to rely on the "Force MP3" hack as primary for now, 
        // but if we genuinely want standard M4A tags, we need a different approach.
        // MP4Box.js is primarily for Parsing/Demuxing in browser. Writing is experimental/hard.

        // Let's re-apply the ID3-on-AAC hack but FORCE the .mp3 extension stronger.
        // Use the exact previous logic but ensure we didn't miss something.
      }

      // Re-applying the ID3Writer logic which is the most reliable "hack" for web.
      const writer = new ID3Writer(audioBuffer);
      writer.setFrame('TIT2', song.name)
        .setFrame('TPE1', [song.primaryArtists])
        .setFrame('TALB', song.album)
        .setFrame('TYER', parseInt(song.year || new Date().getFullYear().toString()))
        .setFrame('TLEN', song.duration * 1000)
        .setFrame('TPUB', song.label)
        .setFrame('TCOP', `© ${song.year} ${song.label}`);

      if (coverBuffer) {
        writer.setFrame('APIC', {
          type: 3,
          data: coverBuffer,
          description: 'Cover'
        });
      }
      writer.addTag();
      finalBlob = writer.getBlob();
      filename = filename.replace('.m4a', '.mp3'); // Force MP3 extension so players read ID3

    } catch (e) {
      console.warn("Metadata embedding failed", e);
      // Metric: If this fails, we just return original
    }

    const blobUrl = URL.createObjectURL(finalBlob);
    return { blobUrl, filename };

  } catch (error) {
    console.error("Download processing failed:", error);
    throw error;
  }
};
