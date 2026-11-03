import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export interface MockMediaItem {
  id: string;
  filename: string;
  title: string;
  category: string;
  type: 'IMAGE' | 'VIDEO';
  mimeType: string;
  sourceUrl: string;
  downloadUrl: string;
  author: string;
  license: string;
  aspectRatio: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export const MOCK_MEDIA_CATALOG: MockMediaItem[] = [
  // ================= IMAGES =================
  {
    id: 'mock-img-arch-01',
    filename: 'mock-img-arch-01.jpg',
    title: 'Minimalist White Architecture and Interior Light',
    category: 'Architecture',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '3:4 (Portrait)',
    width: 1080,
    height: 1440,
    author: 'Scott Webb',
    license: 'Unsplash Free License (Commercial and Non-Commercial)',
    sourceUrl: 'https://unsplash.com/photos/1513694203232-719a280e022f',
    downloadUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1080&h=1440&q=80',
  },
  {
    id: 'mock-img-arch-02',
    filename: 'mock-img-arch-02.jpg',
    title: 'Modern Geometric Skyscraper Facade',
    category: 'Architecture',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '4:5 (Portrait)',
    width: 1080,
    height: 1350,
    author: 'Simone Hutsch',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1486406146926-c627a92ad1ab',
    downloadUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1080&h=1350&q=80',
  },
  {
    id: 'mock-img-nature-01',
    filename: 'mock-img-nature-01.jpg',
    title: 'Yosemite Mountain Valley at Sunset',
    category: 'Nature & Travel',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '16:9 (Landscape)',
    width: 1920,
    height: 1080,
    author: 'Bailey Zindel',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1506744038136-46273834b3fb',
    downloadUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&h=1080&q=80',
  },
  {
    id: 'mock-img-nature-02',
    filename: 'mock-img-nature-02.jpg',
    title: 'Emerald Tropical Ocean Shoreline and Sand',
    category: 'Nature & Travel',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '4:5 (Portrait)',
    width: 1080,
    height: 1350,
    author: 'Sean Oulashin',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1507525428034-b723cf961d3e',
    downloadUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&h=1350&q=80',
  },
  {
    id: 'mock-img-nature-03',
    filename: 'mock-img-nature-03.jpg',
    title: 'Misty Alpine Pine Forest in Morning Light',
    category: 'Nature & Travel',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '16:9 (Landscape)',
    width: 1920,
    height: 1080,
    author: 'Kalen Emsley',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1470071459604-3b5ec3a7fe05',
    downloadUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&h=1080&q=80',
  },
  {
    id: 'mock-img-tech-01',
    filename: 'mock-img-tech-01.jpg',
    title: 'Modern Minimalist Developer Workspace with Mac',
    category: 'Technology & Workspace',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '3:2 (Landscape)',
    width: 1920,
    height: 1280,
    author: 'Domenico Loia',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1498050108023-c5249f4df085',
    downloadUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1920&h=1280&q=80',
  },
  {
    id: 'mock-img-tech-02',
    filename: 'mock-img-tech-02.jpg',
    title: 'Clean Nordic Desk Setup with Mechanical Keyboard',
    category: 'Technology & Workspace',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '4:5 (Portrait)',
    width: 1080,
    height: 1350,
    author: 'Luke Peters',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1518770660439-4636190af475',
    downloadUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&h=1350&q=80',
  },
  {
    id: 'mock-img-food-01',
    filename: 'mock-img-food-01.jpg',
    title: 'Artisanal Latte Art in Ceramic Cup',
    category: 'Culinary & Coffee',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '4:5 (Portrait)',
    width: 1080,
    height: 1350,
    author: 'Nathan Dumlao',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1501339847302-ac426a4a7cbb',
    downloadUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1080&h=1350&q=80',
  },
  {
    id: 'mock-img-food-02',
    filename: 'mock-img-food-02.jpg',
    title: 'Fresh Artisan Croissants and Morning Espresso',
    category: 'Culinary & Coffee',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '1:1 (Square)',
    width: 1080,
    height: 1080,
    author: 'Patrick Tomasso',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1509440159596-0249088772ff',
    downloadUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1080&h=1080&q=80',
  },
  {
    id: 'mock-img-urban-01',
    filename: 'mock-img-urban-01.jpg',
    title: 'Tokyo Rain Reflections and Neon Night Lights',
    category: 'Street & Urban',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '3:4 (Portrait)',
    width: 1080,
    height: 1440,
    author: 'Aleksandar Pasaric',
    license: 'Pexels Free to Use License',
    sourceUrl: 'https://www.pexels.com/photo/neon-street-lights-tokyo/',
    downloadUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1080&h=1440&q=80',
  },
  {
    id: 'mock-img-art-01',
    filename: 'mock-img-art-01.jpg',
    title: 'Abstract 3D Liquid Forms and Pastel Fluid Gradients',
    category: 'Digital Art & 3D',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '1:1 (Square)',
    width: 1080,
    height: 1080,
    author: 'Pawel Czerwinski',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1550745165-9bc0b252726f',
    downloadUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1080&h=1080&q=80',
  },
  {
    id: 'mock-img-art-02',
    filename: 'mock-img-art-02.jpg',
    title: 'Modern Minimal Sculpture in Soft Gallery Lighting',
    category: 'Digital Art & 3D',
    type: 'IMAGE',
    mimeType: 'image/jpeg',
    aspectRatio: '4:5 (Portrait)',
    width: 1080,
    height: 1350,
    author: 'Fakurian Design',
    license: 'Unsplash Free License',
    sourceUrl: 'https://unsplash.com/photos/1541701494587-cb58502866ab',
    downloadUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1080&h=1350&q=80',
  },

  // ================= VIDEOS =================
  {
    id: 'mock-video-waves-01',
    filename: 'mock-video-waves-01.mp4',
    title: 'Majestic Ocean Waves and Marine Wildlife',
    category: 'Nature & Travel',
    type: 'VIDEO',
    mimeType: 'video/mp4',
    aspectRatio: '16:9 (Landscape)',
    width: 1280,
    height: 720,
    durationSeconds: 46,
    author: 'Video.js / Disney Nature Sample',
    license: 'Creative Commons Attribution',
    sourceUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
    downloadUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
  },
  {
    id: 'mock-video-escapes-02',
    filename: 'mock-video-escapes-02.mp4',
    title: 'Blooming Flower and Butterfly in Garden',
    category: 'Nature & Travel',
    type: 'VIDEO',
    mimeType: 'video/mp4',
    aspectRatio: '16:9 (Landscape)',
    width: 1280,
    height: 720,
    durationSeconds: 5,
    author: 'MDN Web Docs / Creative Commons Zero',
    license: 'Creative Commons CC0 (Public Domain)',
    sourceUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    downloadUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  },
  {
    id: 'mock-video-animation-03',
    filename: 'mock-video-animation-03.mp4',
    title: 'Playful Character 3D Animation Motion Loop',
    category: 'Digital Art & 3D',
    type: 'VIDEO',
    mimeType: 'video/mp4',
    aspectRatio: '16:9 (Landscape)',
    width: 640,
    height: 360,
    durationSeconds: 10,
    author: 'Blender Foundation / W3Schools',
    license: 'Creative Commons Attribution 3.0',
    sourceUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    downloadUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
  },
  {
    id: 'mock-video-fun-04',
    filename: 'mock-video-fun-04.mp4',
    title: 'Minimalist Motion Typography and Visuals',
    category: 'Street & Urban',
    type: 'VIDEO',
    mimeType: 'video/mp4',
    aspectRatio: '16:9 (Landscape)',
    width: 1280,
    height: 720,
    durationSeconds: 3,
    author: 'MDN Web Docs / Creative Commons Zero',
    license: 'Creative Commons CC0 (Public Domain)',
    sourceUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    downloadUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
  },
];

function downloadFile(url: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, (response) => {
      // Follow redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return reject(
          new Error(`HTTP status ${response.statusCode} while downloading ${url}`),
        );
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          const stats = fs.statSync(destPath);
          resolve(stats.size);
        });
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function main() {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  console.log(`[Mock Media] Saqlash papkasi: ${uploadsDir}`);
  console.log(`[Mock Media] Jami yuklanadigan fayllar: ${MOCK_MEDIA_CATALOG.length} ta\n`);

  const results: Array<MockMediaItem & { sizeBytes: number; sizeFormatted: string }> = [];

  for (let i = 0; i < MOCK_MEDIA_CATALOG.length; i++) {
    const item = MOCK_MEDIA_CATALOG[i];
    const targetPath = path.join(uploadsDir, item.filename);

    console.log(`[${i + 1}/${MOCK_MEDIA_CATALOG.length}] Yuklanmoqda: ${item.filename} (${item.type})...`);

    try {
      let sizeBytes = 0;
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000) {
        sizeBytes = fs.statSync(targetPath).size;
        console.log(`  -> Fayl diskda allaqachon mavjud (${(sizeBytes / 1024).toFixed(1)} KB)`);
      } else {
        sizeBytes = await downloadFile(item.downloadUrl, targetPath);
        console.log(`  -> Yuklab olindi! Hajmi: ${(sizeBytes / 1024).toFixed(1)} KB`);
      }

      const sizeFormatted =
        sizeBytes > 1024 * 1024
          ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(sizeBytes / 1024).toFixed(1)} KB`;

      results.push({
        ...item,
        sizeBytes,
        sizeFormatted,
      });
    } catch (err: any) {
      console.error(`  XATOLIK (${item.filename}):`, err.message);
    }
  }

  // Metadata faylini uploads papkasida saqlash
  const metadataPath = path.join(uploadsDir, 'mock-media-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n[Mock Media] Barcha metadata fayli saqlandi: ${metadataPath}`);
  console.log(`[Mock Media] Muvaffaqiyatli yuklangan fayllar: ${results.length}/${MOCK_MEDIA_CATALOG.length} ta`);
}

main().catch((err) => {
  console.error('Skriptda kutilmagan xatolik:', err);
  process.exit(1);
});
