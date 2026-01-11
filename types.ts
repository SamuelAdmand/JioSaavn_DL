
export interface SaavnImage {
  quality: string;
  link: string;
}

export interface SaavnDownloadUrl {
  quality: string;
  link: string;
}

export interface SaavnSong {
  id: string;
  name: string;
  album: {
    id: string;
    name: string;
    url: string;
  };
  year: string;
  releaseDate: string;
  duration: number;
  label: string;
  primaryArtists: string;
  featuredArtists: string;
  image: SaavnImage[];
  downloadUrl: SaavnDownloadUrl[];
}

export interface DownloadItem {
  id: string;
  name: string;
  album: string;
  image: string;
  status: string;
  size: string;
  downloadUrl?: string;
  error?: string;
}

export enum Bitrate {
  B12 = 0,
  B48 = 1,
  B96 = 2,
  B160 = 3,
  B320 = 4
}
