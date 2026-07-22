// IndexedDB-based image storage service
// Handles larger storage than localStorage (50MB+ vs 5MB)
// Supports 30+ images easily with IndexedDB's generous quota

const DB_NAME = 'taxdrop-studio';
const DB_VERSION = 3; // Bumped for character store
const STORE_NAME = 'generated-images';
const BLOG_STORE_NAME = 'blog-images';
const CHARACTER_STORE_NAME = 'character-images';

interface StoredImage {
  id: string;
  url: string; // base64 data URL
  platform: string;
  theme: string;
  createdAt: number;
  prompt?: string;
}

export interface StoredCharacterImage {
  id: string;
  url: string; // base64 data URL
  characterId: string;
  scene: string;
  outfit: string;
  pose: string;
  prompt?: string;
  createdAt: number;
}

export interface CharacterRef {
  id: string;
  name: string;
  referenceUrl: string; // base64 data URL of reference photo
  description: string; // physical description for prompt consistency
  createdAt: number;
}

export interface StoredBlogImage {
  id: string;
  url: string;
  title: string;
  type: string;
  prompt?: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

function resetDB(): void {
  dbPromise = null;
  dbInstance = null;
}

function getDB(): Promise<IDBDatabase> {
  // If we have a cached instance, check if it's still usable
  if (dbInstance) {
    try {
      // Try to access a property to check if connection is still valid
      // If the connection is closed, this will throw
      if (dbInstance.objectStoreNames.length >= 0) {
        return Promise.resolve(dbInstance);
      }
    } catch {
      // Connection is closed, reset and get a new one
      resetDB();
    }
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      resetDB();
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      dbInstance = db;

      // Listen for close events to reset the cached connection
      db.onclose = () => {
        console.log('IndexedDB connection closed, will reconnect on next operation');
        resetDB();
      };

      // Listen for version change (another tab upgraded the DB)
      db.onversionchange = () => {
        db.close();
        resetDB();
        console.log('IndexedDB version changed, connection closed');
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create social media images store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('platform', 'platform', { unique: false });
      }

      // Create blog images store if it doesn't exist
      if (!db.objectStoreNames.contains(BLOG_STORE_NAME)) {
        const blogStore = db.createObjectStore(BLOG_STORE_NAME, { keyPath: 'id' });
        blogStore.createIndex('createdAt', 'createdAt', { unique: false });
        blogStore.createIndex('type', 'type', { unique: false });
      }

      // Create character images store if it doesn't exist
      if (!db.objectStoreNames.contains(CHARACTER_STORE_NAME)) {
        const charStore = db.createObjectStore(CHARACTER_STORE_NAME, { keyPath: 'id' });
        charStore.createIndex('createdAt', 'createdAt', { unique: false });
        charStore.createIndex('characterId', 'characterId', { unique: false });
      }
    };
  });

  return dbPromise;
}

// Wrapper to handle stale connection errors and retry
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Check if it's a connection closing error
    if (error instanceof Error && error.message.includes('connection is closing')) {
      console.log('Database connection was closing, retrying...');
      resetDB();
      return await operation();
    }
    throw error;
  }
}

// Save an image to IndexedDB
export async function saveImage(image: Omit<StoredImage, 'id' | 'createdAt'>): Promise<StoredImage> {
  const storedImage: StoredImage = {
    ...image,
    id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };

  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(storedImage);

      request.onsuccess = () => resolve(storedImage);
      request.onerror = () => reject(request.error);
    });
  });
}

// Get all images, sorted by most recent first
export async function getAllImages(): Promise<StoredImage[]> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Descending order

      const images: StoredImage[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          images.push(cursor.value);
          cursor.continue();
        } else {
          resolve(images);
        }
      };

      request.onerror = () => reject(request.error);
    });
  });
}

// Delete an image by ID
export async function deleteImage(id: string): Promise<void> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Delete all images
export async function clearAllImages(): Promise<void> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Get storage stats
export async function getStorageStats(): Promise<{ count: number; estimatedSize: string }> {
  const images = await getAllImages();

  // Estimate size by summing base64 string lengths
  let totalBytes = 0;
  for (const img of images) {
    totalBytes += img.url.length;
    totalBytes += (img.platform?.length || 0);
    totalBytes += (img.theme?.length || 0);
    totalBytes += (img.prompt?.length || 0);
  }

  // Format size
  let estimatedSize: string;
  if (totalBytes < 1024) {
    estimatedSize = `${totalBytes} B`;
  } else if (totalBytes < 1024 * 1024) {
    estimatedSize = `${(totalBytes / 1024).toFixed(1)} KB`;
  } else {
    estimatedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    count: images.length,
    estimatedSize,
  };
}

// Migrate from localStorage to IndexedDB (one-time migration)
export async function migrateFromLocalStorage(): Promise<number> {
  const LEGACY_KEY = 'social-media-images';
  const legacyData = localStorage.getItem(LEGACY_KEY);

  if (!legacyData) return 0;

  try {
    const images = JSON.parse(legacyData) as Array<{
      url: string;
      platform: string;
      theme: string;
      prompt?: string;
    }>;

    let migrated = 0;
    for (const img of images) {
      await saveImage({
        url: img.url,
        platform: img.platform,
        theme: img.theme,
        prompt: img.prompt,
      });
      migrated++;
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(LEGACY_KEY);
    console.log(`Migrated ${migrated} images from localStorage to IndexedDB`);

    return migrated;
  } catch (err) {
    console.error('Failed to migrate from localStorage:', err);
    return 0;
  }
}

// ============== BLOG IMAGE STORAGE ==============

// Save a blog image to IndexedDB
export async function saveBlogImage(image: Omit<StoredBlogImage, 'id' | 'createdAt'>): Promise<StoredBlogImage> {
  const storedImage: StoredBlogImage = {
    ...image,
    id: `blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };

  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BLOG_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(BLOG_STORE_NAME);
      const request = store.add(storedImage);

      request.onsuccess = () => resolve(storedImage);
      request.onerror = () => reject(request.error);
    });
  });
}

// Get all blog images, sorted by most recent first
export async function getAllBlogImages(): Promise<StoredBlogImage[]> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BLOG_STORE_NAME, 'readonly');
      const store = transaction.objectStore(BLOG_STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Descending order

      const images: StoredBlogImage[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          images.push(cursor.value);
          cursor.continue();
        } else {
          resolve(images);
        }
      };

      request.onerror = () => reject(request.error);
    });
  });
}

// Delete a blog image by ID
export async function deleteBlogImage(id: string): Promise<void> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BLOG_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(BLOG_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Delete all blog images
export async function clearAllBlogImages(): Promise<void> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BLOG_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(BLOG_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Get blog storage stats
export async function getBlogStorageStats(): Promise<{ count: number; estimatedSize: string }> {
  const images = await getAllBlogImages();

  let totalBytes = 0;
  for (const img of images) {
    totalBytes += img.url.length;
    totalBytes += (img.title?.length || 0);
    totalBytes += (img.type?.length || 0);
    totalBytes += (img.prompt?.length || 0);
  }

  let estimatedSize: string;
  if (totalBytes < 1024) {
    estimatedSize = `${totalBytes} B`;
  } else if (totalBytes < 1024 * 1024) {
    estimatedSize = `${(totalBytes / 1024).toFixed(1)} KB`;
  } else {
    estimatedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    count: images.length,
    estimatedSize,
  };
}

// Migrate blog images from localStorage to IndexedDB
export async function migrateBlogImagesFromLocalStorage(): Promise<number> {
  const LEGACY_KEY = 'blog-generated-images';
  const legacyData = localStorage.getItem(LEGACY_KEY);

  if (!legacyData) return 0;

  try {
    const images = JSON.parse(legacyData) as Array<{
      url: string;
      title: string;
      type: string;
      prompt?: string;
    }>;

    let migrated = 0;
    for (const img of images) {
      await saveBlogImage({
        url: img.url,
        title: img.title,
        type: img.type,
        prompt: img.prompt,
      });
      migrated++;
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(LEGACY_KEY);
    console.log(`Migrated ${migrated} blog images from localStorage to IndexedDB`);

    return migrated;
  } catch (err) {
    console.error('Failed to migrate blog images from localStorage:', err);
    return 0;
  }
}

// ============== CHARACTER IMAGE STORAGE ==============

const CHARACTER_REF_KEY = 'character-references';

// Save a character reference (stored in localStorage since it's small metadata + one image)
export function saveCharacterRef(ref: Omit<CharacterRef, 'id' | 'createdAt'>): CharacterRef {
  const stored: CharacterRef = {
    ...ref,
    id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  const existing = getCharacterRefs();
  existing.push(stored);
  localStorage.setItem(CHARACTER_REF_KEY, JSON.stringify(existing));
  return stored;
}

// Get all character references
export function getCharacterRefs(): CharacterRef[] {
  try {
    const data = localStorage.getItem(CHARACTER_REF_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Delete a character reference
export function deleteCharacterRef(id: string): void {
  const existing = getCharacterRefs().filter(r => r.id !== id);
  localStorage.setItem(CHARACTER_REF_KEY, JSON.stringify(existing));
}

// Save a generated character image to IndexedDB
export async function saveCharacterImage(image: Omit<StoredCharacterImage, 'id' | 'createdAt'>): Promise<StoredCharacterImage> {
  const storedImage: StoredCharacterImage = {
    ...image,
    id: `charimg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };

  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CHARACTER_STORE_NAME);
      const request = store.add(storedImage);

      request.onsuccess = () => resolve(storedImage);
      request.onerror = () => reject(request.error);
    });
  });
}

// Get all character images, sorted by most recent first
export async function getAllCharacterImages(): Promise<StoredCharacterImage[]> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHARACTER_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CHARACTER_STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev');

      const images: StoredCharacterImage[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          images.push(cursor.value);
          cursor.continue();
        } else {
          resolve(images);
        }
      };

      request.onerror = () => reject(request.error);
    });
  });
}

// Delete a character image by ID
export async function deleteCharacterImage(id: string): Promise<void> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CHARACTER_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Clear all character images
export async function clearAllCharacterImages(): Promise<void> {
  return withRetry(async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHARACTER_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CHARACTER_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}
