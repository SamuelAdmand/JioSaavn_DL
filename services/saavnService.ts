
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
import ID3Writer from 'browser-id3-writer';
// import * as MP4Box from 'mp4box'; // Removed to prevent build errors

export const downloadSong = async (song: SaavnSong, downloadUrl: string): Promise<{ blobUrl: string, filename: string }> => {
  try {
    // 1. Fetch Audio
    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) throw new Error("Failed to fetch audio file");
    const audioBuffer = await audioRes.arrayBuffer();

    // 2. Prepare Filename
    const cleanName = song.name.replace(/[^a-z0-9]/gi, '_');
    // Ensure artist exists or fallback to 'Unknown'
    const artistName = (song.primaryArtists || 'Unknown Artist').split(',')[0].trim();
    const cleanArtist = artistName.replace(/[^a-z0-9]/gi, '_') || 'Unknown';

    // Default to .mp3 because we are going to force an ID3 header
    let filename = `${cleanName} - ${cleanArtist}.mp3`;

    // 3. Fetch Cover Art
    let coverBuffer: ArrayBuffer | undefined;
    const coverUrl = song.image[song.image.length - 1]?.link || song.image[0]?.link;
    if (coverUrl) {
      try {
        const coverRes = await fetch(coverUrl);
        if (coverRes.ok) coverBuffer = await coverRes.arrayBuffer();
      } catch (e) { console.warn("Cover art fetch failed", e); }
    }

    let finalBlob: Blob;

    // 4. "Trojan Horse" Metadata Injection
    // Problem: ID3Writer throws error if we pass it AAC/M4A data. 
    // Solution: We pass it an EMPTY buffer to generate valid ID3 headers (Title, Artist, Cover Art).
    //           Then we manually concatenate [ID3 Header] + [AAC Audio Data].
    //           We save as .mp3. Player reads tags, then hits audio stream.
    try {
      const writer = new ID3Writer(new ArrayBuffer(0)); // Dummy buffer to generate tags only
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

      const id3TagBlob = writer.getBlob(); // This blob contains ONLY the ID3v2 Header + Frames

      // Combine: [ID3 Tags] + [Original Audio]
      // This is a valid ID3 file structure (ID3 tags are prepended).
      finalBlob = new Blob([id3TagBlob, audioBuffer], { type: 'audio/mp3' });

    } catch (e) {
      console.warn("Metadata injection failed", e);
      // Absolute fallback: Just save the distinct audio without tags
      finalBlob = new Blob([audioBuffer], { type: 'audio/mp4' });
      filename = filename.replace('.mp3', '.m4a');
    }

    const blobUrl = URL.createObjectURL(finalBlob);
    return { blobUrl, filename };

  } catch (error) {
    console.error("Download processing failed:", error);
    throw error;
  }
};
