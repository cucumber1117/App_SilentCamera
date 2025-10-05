// モバイル写真保存ユーティリティ
// スマホの写真アプリに直接保存する機能

/**
 * デバイスタイプを判定
 * @returns {object} デバイス情報
 */
export const detectDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
               (platform === 'macintel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(userAgent);
  const isMobile = isIOS || isAndroid || /mobile|tablet/.test(userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  return {
    isIOS,
    isAndroid,
    isMobile,
    isStandalone,
    supportsWebShare: !!navigator.share,
    supportsFileSystemAccess: !!window.showSaveFilePicker,
    userAgent,
    platform
  };
};

/**
 * DataURLからBlobを生成
 * @param {string} dataURL - 画像のDataURL
 * @param {string} filename - ファイル名
 * @returns {File} Fileオブジェクト
 */
export const dataURLtoFile = (dataURL, filename) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

/**
 * Web Share APIを使用して写真を共有・保存
 * @param {string} dataURL - 画像のDataURL
 * @param {string} filename - ファイル名
 * @returns {Promise<boolean>} 成功/失敗
 */
export const sharePhotoToDevice = async (dataURL, filename = null) => {
  const device = detectDevice();
  
  if (!device.supportsWebShare) {
    throw new Error('このデバイスはWeb Share APIをサポートしていません');
  }
  
  try {
    // ファイル名を生成
    const finalFilename = filename || `silent_camera_${new Date().getTime()}.png`;
    
    // DataURLからFileオブジェクトを作成
    const file = dataURLtoFile(dataURL, finalFilename);
    
    // Web Share APIで共有
    await navigator.share({
      title: 'Silent Camera Photo',
      text: 'Silent Cameraで撮影した写真',
      files: [file]
    });
    
    console.log('写真の共有が完了しました');
    return true;
  } catch (error) {
    console.error('写真共有エラー:', error);
    
    if (error.name === 'AbortError') {
      console.log('ユーザーが共有をキャンセルしました');
      return false;
    }
    
    throw error;
  }
};

/**
 * 写真を直接ダウンロード（フォールバック）
 * @param {string} dataURL - 画像のDataURL
 * @param {string} filename - ファイル名
 * @returns {boolean} 成功/失敗
 */
export const downloadPhotoDirectly = (dataURL, filename = null) => {
  try {
    const finalFilename = filename || `silent_camera_${new Date().getTime()}.png`;
    
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = finalFilename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('写真のダウンロードが完了しました');
    return true;
  } catch (error) {
    console.error('写真ダウンロードエラー:', error);
    return false;
  }
};

/**
 * 最適な保存方法を選択して写真を保存
 * @param {string} dataURL - 画像のDataURL
 * @param {string} filename - ファイル名
 * @returns {Promise<object>} 保存結果
 */
export const savePhotoOptimally = async (dataURL, filename = null) => {
  const device = detectDevice();
  const finalFilename = filename || `silent_camera_${new Date().getTime()}.png`;
  
  console.log('デバイス情報:', device);
  
  // モバイルデバイスでWeb Share APIが利用可能な場合
  if (device.isMobile && device.supportsWebShare) {
    try {
      const shareSuccess = await sharePhotoToDevice(dataURL, finalFilename);
      return {
        success: shareSuccess,
        method: 'webshare',
        message: shareSuccess ? '写真アプリに保存されました' : 'キャンセルされました'
      };
    } catch (error) {
      console.warn('Web Share失敗、ダウンロードにフォールバック:', error.message);
      
      // フォールバック: 直接ダウンロード
      const downloadSuccess = downloadPhotoDirectly(dataURL, finalFilename);
      return {
        success: downloadSuccess,
        method: 'download',
        message: downloadSuccess ? 'ダウンロードフォルダに保存されました' : '保存に失敗しました'
      };
    }
  }
  
  // デスクトップまたはWeb Share非対応の場合
  const downloadSuccess = downloadPhotoDirectly(dataURL, finalFilename);
  return {
    success: downloadSuccess,
    method: 'download',
    message: downloadSuccess ? 'ダウンロードフォルダに保存されました' : '保存に失敗しました'
  };
};

/**
 * PWAのインストール状態をチェック
 * @returns {boolean} PWAとしてインストールされているか
 */
export const isPWAInstalled = () => {
  const device = detectDevice();
  return device.isStandalone;
};

/**
 * 保存機能の利用可能性をチェック
 * @returns {object} 利用可能な機能
 */
export const checkSaveCapabilities = () => {
  const device = detectDevice();
  
  return {
    webShare: device.supportsWebShare,
    fileSystemAccess: device.supportsFileSystemAccess,
    directDownload: true, // 常に利用可能
    nativePhotoSave: device.isMobile && device.supportsWebShare,
    recommendedMethod: device.isMobile && device.supportsWebShare ? 'webshare' : 'download'
  };
};