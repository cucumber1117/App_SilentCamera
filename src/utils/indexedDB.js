// IndexedDBヘルパー関数
// 写真の永続保存のためのデータベース操作

const DB_NAME = 'SilentCameraDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

// データベースを開く
export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('データベースのオープンに失敗:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 既存のオブジェクトストアを削除（存在する場合）
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      
      // 新しいオブジェクトストアを作成
      const store = db.createObjectStore(STORE_NAME, { 
        keyPath: 'id' 
      });
      
      // インデックスを作成
      store.createIndex('timestamp', 'timestamp', { unique: false });
      
      console.log('データベースが初期化されました');
    };
  });
};

// 写真を保存
export const savePhoto = async (photoData) => {
  try {
    console.log('IndexedDB保存開始:', photoData.id);
    const db = await openDatabase();
    console.log('データベース接続成功');
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    console.log('ストア取得成功');
    
    const request = store.add(photoData);
    console.log('保存リクエスト送信');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('写真が保存されました:', photoData.id);
        resolve(photoData.id);
      };
      
      request.onerror = () => {
        console.error('写真保存エラー:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('写真保存失敗:', error);
    throw error;
  }
};

// すべての写真を取得
export const getAllPhotos = async () => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    // タイムスタンプ順で取得（新しい順）
    const request = index.openCursor(null, 'prev');
    
    return new Promise((resolve, reject) => {
      const photos = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          photos.push(cursor.value);
          cursor.continue();
        } else {
          console.log('写真を読み込みました:', photos.length + '件');
          resolve(photos);
        }
      };
      
      request.onerror = () => {
        console.error('写真取得エラー:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('写真取得失敗:', error);
    throw error;
  }
};

// 写真を削除
export const deletePhoto = async (photoId) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(photoId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('写真が削除されました:', photoId);
        resolve(photoId);
      };
      
      request.onerror = () => {
        console.error('写真削除エラー:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('写真削除失敗:', error);
    throw error;
  }
};

// 特定の写真を取得
export const getPhoto = async (photoId) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(photoId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error('写真取得エラー:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('写真取得失敗:', error);
    throw error;
  }
};

// データベース容量チェック（概算）
export const checkStorageUsage = async () => {
  try {
    const photos = await getAllPhotos();
    let totalSize = 0;
    
    photos.forEach(photo => {
      // Base64データの概算サイズ計算
      const base64Length = photo.dataURL.length;
      const sizeInBytes = (base64Length * 3) / 4;
      totalSize += sizeInBytes;
    });
    
    return {
      photoCount: photos.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('容量チェック失敗:', error);
    return { photoCount: 0, totalSizeBytes: 0, totalSizeMB: '0.00' };
  }
};