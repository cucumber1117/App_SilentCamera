// サムネイル生成ユーティリティ
// ギャラリーのパフォーマンス向上のため

/**
 * 画像からサムネイルを生成する
 * @param {string} dataURL - 元画像のデータURL
 * @param {number} maxWidth - サムネイルの最大幅
 * @param {number} maxHeight - サムネイルの最大高さ
 * @param {number} quality - 圧縮品質 (0.1-1.0)
 * @returns {Promise<string>} サムネイルのデータURL
 */
export const generateThumbnail = (dataURL, maxWidth = 200, maxHeight = 200, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Canvas要素を作成
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // アスペクト比を保持してサムネイルサイズを計算
        const { width: thumbWidth, height: thumbHeight } = calculateThumbnailSize(
          img.width, 
          img.height, 
          maxWidth, 
          maxHeight
        );
        
        // キャンバスサイズを設定
        canvas.width = thumbWidth;
        canvas.height = thumbHeight;
        
        // 高品質レンダリング設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // サムネイルを描画
        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
        
        // JPEG形式で軽量化して出力
        const thumbnailDataURL = canvas.toDataURL('image/jpeg', quality);
        resolve(thumbnailDataURL);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };
    
    img.src = dataURL;
  });
};

/**
 * アスペクト比を保持してサムネイルサイズを計算
 * @param {number} originalWidth - 元画像の幅
 * @param {number} originalHeight - 元画像の高さ
 * @param {number} maxWidth - 最大幅
 * @param {number} maxHeight - 最大高さ
 * @returns {object} 計算されたサムネイルサイズ
 */
const calculateThumbnailSize = (originalWidth, originalHeight, maxWidth, maxHeight) => {
  const aspectRatio = originalWidth / originalHeight;
  
  let width, height;
  
  if (originalWidth > originalHeight) {
    // 横長の場合
    width = Math.min(maxWidth, originalWidth);
    height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
  } else {
    // 縦長または正方形の場合
    height = Math.min(maxHeight, originalHeight);
    width = height * aspectRatio;
    
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height)
  };
};

/**
 * 写真データにサムネイルを追加
 * @param {object} photo - 写真オブジェクト
 * @returns {Promise<object>} サムネイル付き写真オブジェクト
 */
export const addThumbnailToPhoto = async (photo) => {
  try {
    if (photo.thumbnail) {
      // すでにサムネイルが存在する場合はそのまま返す
      return photo;
    }
    
    console.log('サムネイル生成中:', photo.id);
    const thumbnail = await generateThumbnail(photo.dataURL, 200, 200, 0.7);
    
    return {
      ...photo,
      thumbnail: thumbnail
    };
  } catch (error) {
    console.error('サムネイル生成エラー:', error);
    // サムネイル生成に失敗した場合は元の写真をそのまま返す
    return photo;
  }
};

/**
 * 写真リストに一括でサムネイルを生成
 * @param {Array} photos - 写真配列
 * @returns {Promise<Array>} サムネイル付き写真配列
 */
export const generateThumbnailsForPhotos = async (photos) => {
  try {
    console.log('一括サムネイル生成開始:', photos.length + '件');
    
    // 並列処理でサムネイルを生成（最大5並列）
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);
      const batchPromises = batch.map(photo => addThumbnailToPhoto(photo));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // プログレス表示
      console.log(`サムネイル生成進捗: ${Math.min(i + batchSize, photos.length)}/${photos.length}`);
    }
    
    console.log('一括サムネイル生成完了');
    return results;
  } catch (error) {
    console.error('一括サムネイル生成エラー:', error);
    return photos; // エラーの場合は元の配列を返す
  }
};